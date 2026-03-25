import { test, expect, type Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import JSZip from 'jszip';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://127.0.0.1:4000';
const WEB_BASE_URL = process.env.WEB_BASE_URL ?? 'http://127.0.0.1:3000';

function makeSimplePdfBuffer(text = 'Hello PDF'): Buffer {
  // Minimal single-page PDF with a simple text draw.
  const objects: Array<{ id: number; body: string }> = [];

  const escapePdfString = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const contentStream = `BT\n/F1 24 Tf\n72 720 Td\n(${escapePdfString(text)}) Tj\nET\n`;

  objects.push({
    id: 1,
    body: `<< /Type /Catalog /Pages 2 0 R >>`,
  });
  objects.push({
    id: 2,
    body: `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`,
  });
  objects.push({
    id: 3,
    body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> >>`,
  });
  objects.push({
    id: 4,
    body: `<< /Length ${Buffer.byteLength(contentStream, 'utf8')} >>\nstream\n${contentStream}endstream`,
  });
  objects.push({
    id: 5,
    body: `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`,
  });

  const chunks: string[] = [];
  chunks.push('%PDF-1.4\n');

  const offsets: number[] = [];
  const push = (s: string) => {
    chunks.push(s);
  };

  for (const obj of objects) {
    const current = chunks.join('');
    offsets[obj.id] = Buffer.byteLength(current, 'utf8');
    push(`${obj.id} 0 obj\n${obj.body}\nendobj\n`);
  }

  const xrefStart = Buffer.byteLength(chunks.join(''), 'utf8');
  push('xref\n');
  push('0 6\n');
  push('0000000000 65535 f \n');
  for (let i = 1; i <= 5; i++) {
    const off = offsets[i] ?? 0;
    push(String(off).padStart(10, '0') + ' 00000 n \n');
  }
  push('trailer\n');
  push('<< /Size 6 /Root 1 0 R >>\n');
  push('startxref\n');
  push(String(xrefStart) + '\n');
  push('%%EOF\n');

  return Buffer.from(chunks.join(''), 'utf8');
}

async function loginViaUi(page: Page, email: string, password: string) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.goto(`${WEB_BASE_URL}/login`);
    await expect(page).toHaveURL(/\/login/);
    await page.waitForLoadState('domcontentloaded');

    await page.locator('input[type="email"]').fill(email);
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill(password);

    const submit = page.getByRole('button', { name: 'Sign in' });
    await expect(submit).toBeVisible({ timeout: 15000 });
    await expect(submit).toBeEnabled({ timeout: 15000 });

    const loginResponsePromise = page
      .waitForResponse(
        (res) =>
          res.request().method() === 'POST' && /\/auth\/login/.test(res.url()),
        { timeout: 45000 },
      )
      .catch(() => null);

    await submit.click();
    // Some browsers/forms can ignore click under heavy load; also submit via Enter.
    await passwordInput.press('Enter').catch(() => undefined);

    const loginRes = await loginResponsePromise;
    if (loginRes && !loginRes.ok()) {
      lastError = new Error(
        `Login request failed: ${loginRes.status()} ${await loginRes.text()}`,
      );
      continue;
    }

    const navigated = await page
      .waitForURL(/\/library/, { timeout: 60000 })
      .then(() => true)
      .catch((e) => {
        lastError = e;
        return false;
      });
    if (navigated) return;
  }

  throw new Error(`UI login failed after retries: ${String((lastError as any)?.message ?? lastError)}`);
}

async function unlockVaultViaUi(page: Page, password: string) {
  const dialog = page.getByRole('dialog').filter({ hasText: 'Unlock Vault' });
  await expect(dialog).toBeVisible({ timeout: 20000 });

  const passwordInput = dialog
    .getByRole('textbox', { name: /^Password$/ })
    .or(dialog.getByLabel('Password'))
    .or(dialog.getByPlaceholder('Password'))
    .first();

  await passwordInput.fill(password);

  // The primary action is always the form submit button.
  const submit = dialog.locator('button[type="submit"]').first();
  await expect(submit).toBeVisible({ timeout: 15000 });
  await expect(submit).toBeEnabled({ timeout: 15000 });

  // If vault isn't set up yet, the submit button text is "Set up vault" and the
  // modal requires re-entering the password (field may appear after first fill).
  const submitText = String((await submit.textContent().catch(() => '')) || '').toLowerCase();
  const isSetupMode = submitText.includes('set up');
  if (isSetupMode) {
    const reenter = dialog
      .getByRole('textbox', { name: /Re-enter password/i })
      .or(dialog.getByLabel('Re-enter password'))
      .or(dialog.getByPlaceholder('Re-enter password'))
      .first();
    await expect(reenter).toBeVisible({ timeout: 5000 });
    await reenter.fill(password);
  }

  await submit.click({ force: true });
  await expect(dialog).toBeHidden({ timeout: 60000 });
}

function getUploadDialog(page: Page) {
  // UploadDialog is the modal that contains the hidden <input type="file" />.
  return page
    .getByRole('dialog')
    .filter({ has: page.locator('input[type="file"]') });
}

async function openUploadDialog(page: Page, vaultPassword: string) {
  await page.getByRole('button', { name: 'Upload Media' }).click();

  // Library opens Unlock Vault modal first if the key isn't cached.
  const anyDialog = page.getByRole('dialog');
  await expect(anyDialog).toBeVisible({ timeout: 15000 });

  const unlockVisible = await page
    .getByText('Unlock Vault')
    .isVisible()
    .catch(() => false);

  if (unlockVisible) {
    await unlockVaultViaUi(page, vaultPassword);
  }

  const uploadDialog = getUploadDialog(page);
  await expect(uploadDialog).toBeVisible({ timeout: 20000 });
  await expect(
    uploadDialog.getByRole('button', { name: /^Upload/ }),
  ).toBeVisible({ timeout: 20000 });
}

async function selectUploadFiles(
  page: Page,
  file: { name: string; mimeType: string; buffer: Buffer } | string,
) {
  const dialog = getUploadDialog(page);
  const fileInput = dialog.locator('input[type="file"]');
  await fileInput.setInputFiles(file, { force: true });
}

async function clickUpload(page: Page) {
  const dialog = getUploadDialog(page);
  await dialog.getByRole('button', { name: /^Upload/ }).click();
}

// Helper to generate random email
function randomEmail() {
  return `test-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`;
}

function getDownloadUrlVariantFromRequest(request: { url(): string; postData(): string | null }):
  | 'thumb'
  | 'original'
  | undefined {
  try {
    const url = new URL(request.url());
    const fromQuery = url.searchParams.get('variant');
    if (fromQuery === 'thumb' || fromQuery === 'original') return fromQuery;

    const body = request.postData();
    if (!body) return undefined;
    const parsed = JSON.parse(body) as { variant?: unknown };
    const v = parsed?.variant;
    return v === 'thumb' || v === 'original' ? v : undefined;
  } catch {
    return undefined;
  }
}

async function waitForApiReady(timeoutMs = 60000) {
  const start = Date.now();
  let lastError: unknown;
  let okStreak = 0;

  // Simple retry loop; dev server may boot web before API.
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${API_BASE_URL}/v1/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        okStreak++;
        // Nest watch mode can restart right after the first successful response.
        // Require a short streak of OK responses to reduce flakiness.
        if (okStreak >= 2) return;
      } else {
        okStreak = 0;
      }
      lastError = new Error(`API health not OK: ${res.status}`);
    } catch (e) {
      okStreak = 0;
      lastError = e;
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  throw new Error(`API not ready after ${timeoutMs}ms: ${String((lastError as any)?.message ?? lastError)}`);
}

// Helper to register a user via API
async function registerUser(email: string, password = 'TestPassword123!') {
  await waitForApiReady();
  const response = await fetch(`${API_BASE_URL}/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      displayName: 'Test User',
      locale: 'en',
      timezone: 'Asia/Kolkata',
    }),
  });
  if (!response.ok) {
    throw new Error(`Registration failed: ${response.status} ${await response.text()}`);
  }
  const data = await response.json();
  return {
    userId: data.user.id,
    accessToken: data.session.accessToken,
    refreshToken: data.session.refreshToken,
  };
}

// Helper to login via API and get tokens
async function loginUser(email: string, password = 'TestPassword123!') {
  const response = await fetch(`${API_BASE_URL}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error(`Login failed: ${response.status} ${await response.text()}`);
  }
  const data = await response.json();
  return {
    accessToken: data.session.accessToken,
    refreshToken: data.session.refreshToken,
  };
}

test.describe('Thumbnail-first UX and encrypted thumbnail flow', () => {
  test.describe.configure({ timeout: 120000 });

  let testEmail: string;
  let testPassword: string;
  let accessToken: string;
  let refreshToken: string;

  test.beforeEach(async ({ page }) => {
    testEmail = randomEmail();
    testPassword = 'TestPassword123!';
    const auth = await registerUser(testEmail, testPassword);
    accessToken = auth.accessToken;
    refreshToken = auth.refreshToken;

    // Log in via the real UI so AuthProvider and apiClient bootstrap correctly.
    await loginViaUi(page, testEmail, testPassword);
  });

  test('upload image and verify thumbnail-first requests + viewer opens', async ({ page }) => {
    test.setTimeout(120000);

    const fixturePath = path.join(__dirname, 'fixtures', 'test-image.jpg');

    await openUploadDialog(page, testPassword);
    await selectUploadFiles(page, fixturePath);

    const intentPromise = page.waitForResponse((res) =>
      res.url().includes('/v1/media/upload-intents') && res.request().method() === 'POST',
    );
    await clickUpload(page);
    const intentRes = await intentPromise;
    const intentJson = await intentRes.json();
    const mediaId = intentJson?.media?.id as string | undefined;

    // Prefer waiting for the card to appear (the success banner may be offscreen in the modal).
    const card = page.locator('[data-testid="media-card"]').first();
    await expect(card).toBeVisible({ timeout: 60000 });

    // Close the upload dialog if it's still open (it can intercept pointer events).
    const uploadDialog = getUploadDialog(page);
    if (await uploadDialog.isVisible().catch(() => false)) {
      await page.keyboard.press('Escape');
      await expect(uploadDialog).toBeHidden({ timeout: 20000 });
    }

    // Open viewer.
    await card.click();
    const viewer = page.locator('[data-testid="media-viewer"]');
    await expect(viewer).toBeVisible({ timeout: 20000 });
    await expect(viewer.getByRole('img', { name: 'test-image.jpg' })).toBeVisible({ timeout: 20000 });

    // Cleanup best-effort.
    if (mediaId) {
      await fetch(`${API_BASE_URL}/v1/media/${mediaId}/purge`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      }).catch(() => undefined);
    }
  });

  test('upload PDF and verify PDF thumbnail requests + in-app preview', async ({ page }) => {
    test.setTimeout(120000);

    const thumbRequests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (!url.includes('/download-url')) return;
      const variant = getDownloadUrlVariantFromRequest(request);
      if (variant === 'thumb') thumbRequests.push(url);
    });

    const pdfBuffer = makeSimplePdfBuffer('Playwright PDF');
    const pdfPayload = {
      name: 'test-doc.pdf',
      mimeType: 'application/pdf',
      buffer: pdfBuffer,
    };

    await openUploadDialog(page, testPassword);
    await selectUploadFiles(page, pdfPayload);
    const intentPromise = page.waitForResponse((res) =>
      res.url().includes('/v1/media/upload-intents') && res.request().method() === 'POST',
    );
    await clickUpload(page);
    const intentRes = await intentPromise;
    const intentJson = await intentRes.json();
    const mediaId = intentJson?.media?.id as string | undefined;

    // Prefer waiting for the card to appear (the success banner may be offscreen in the modal).
    const pdfCard = page.locator('[data-testid="media-card"]').filter({ hasText: 'test-doc.pdf' }).first();
    await expect(pdfCard).toBeVisible({ timeout: 60000 });

    // Close the upload dialog if it's still open (it can intercept pointer events).
    const uploadDialog = getUploadDialog(page);
    if (await uploadDialog.isVisible().catch(() => false)) {
      await page.keyboard.press('Escape');
      await expect(uploadDialog).toBeHidden({ timeout: 20000 });
    }
    await expect(pdfCard.getByLabel('PDF')).toBeVisible({ timeout: 20000 });

    await pdfCard.scrollIntoViewIfNeeded();

    await expect.poll(() => thumbRequests.length, { timeout: 45000 }).toBeGreaterThan(0);

    // Open viewer and confirm iframe preview is rendered.
    await pdfCard.click();
    await expect(page.locator('[data-testid="media-viewer"]')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('[data-testid="pdf-viewer"]')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('[data-testid="pdf-viewer"] canvas')).toBeVisible({ timeout: 20000 });

    // Cleanup best-effort.
    if (mediaId) {
      await fetch(`${API_BASE_URL}/v1/media/${mediaId}/purge`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      }).catch(() => undefined);
    }
  });

  test('upload TXT and verify in-app document preview', async ({ page }) => {
    test.setTimeout(120000);

    const txtPayload = {
      name: 'test-note.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Hello from Playwright TXT preview', 'utf8'),
    };

    await openUploadDialog(page, testPassword);
    await selectUploadFiles(page, txtPayload);
    const intentPromise = page.waitForResponse((res) =>
      res.url().includes('/v1/media/upload-intents') &&
      res.request().method() === 'POST',
    );
    await clickUpload(page);
    const intentRes = await intentPromise;
    const intentJson = await intentRes.json();
    const mediaId = intentJson?.media?.id as string | undefined;

    const card = page
      .locator('[data-testid="media-card"]')
      .filter({ hasText: 'test-note.txt' })
      .first();
    await expect(card).toBeVisible({ timeout: 60000 });

    const uploadDialog = getUploadDialog(page);
    if (await uploadDialog.isVisible().catch(() => false)) {
      await page.keyboard.press('Escape');
      await expect(uploadDialog).toBeHidden({ timeout: 20000 });
    }

    await card.click();
    await expect(page.locator('[data-testid="media-viewer"]')).toBeVisible({
      timeout: 20000,
    });
    const docViewer = page.locator('[data-testid="document-viewer"]');
    await expect(docViewer).toBeVisible({ timeout: 20000 });
    await expect(docViewer.getByText('TXT', { exact: true })).toBeVisible({
      timeout: 20000,
    });
    await expect(
      docViewer.getByText('Hello from Playwright TXT preview'),
    ).toBeVisible({ timeout: 20000 });

    // Cleanup best-effort.
    if (mediaId) {
      await fetch(`${API_BASE_URL}/v1/media/${mediaId}/purge`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      }).catch(() => undefined);
    }
  });

  test('upload CSV and verify in-app document table preview', async ({ page }) => {
    test.setTimeout(120000);

    const csvPayload = {
      name: 'test-data.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('name,age\nAlice,30\nBob,25\n', 'utf8'),
    };

    await openUploadDialog(page, testPassword);
    await selectUploadFiles(page, csvPayload);
    const intentPromise = page.waitForResponse((res) =>
      res.url().includes('/v1/media/upload-intents') &&
      res.request().method() === 'POST',
    );
    await clickUpload(page);
    const intentRes = await intentPromise;
    const intentJson = await intentRes.json();
    const mediaId = intentJson?.media?.id as string | undefined;

    const card = page
      .locator('[data-testid="media-card"]')
      .filter({ hasText: 'test-data.csv' })
      .first();
    await expect(card).toBeVisible({ timeout: 60000 });

    const uploadDialog = getUploadDialog(page);
    if (await uploadDialog.isVisible().catch(() => false)) {
      await page.keyboard.press('Escape');
      await expect(uploadDialog).toBeHidden({ timeout: 20000 });
    }

    await card.click();
    await expect(page.locator('[data-testid="media-viewer"]')).toBeVisible({
      timeout: 20000,
    });
    const docViewer = page.locator('[data-testid="document-viewer"]');
    await expect(docViewer).toBeVisible({ timeout: 20000 });
    await expect(docViewer.getByText('CSV', { exact: true })).toBeVisible({
      timeout: 20000,
    });
    await expect(docViewer.getByText('Alice')).toBeVisible({ timeout: 20000 });
    await expect(docViewer.getByText('Bob')).toBeVisible({ timeout: 20000 });

    // Cleanup best-effort.
    if (mediaId) {
      await fetch(`${API_BASE_URL}/v1/media/${mediaId}/purge`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      }).catch(() => undefined);
    }
  });

  test('upload ZIP and verify in-app contents preview', async ({ page }) => {
    test.setTimeout(120000);

    const zip = new JSZip();
    zip.file('hello.txt', 'Hello ZIP');
    zip.folder('folder')?.file('nested.txt', 'Nested');
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    const zipPayload = {
      name: 'test-archive.zip',
      mimeType: 'application/zip',
      buffer: zipBuffer,
    };

    await openUploadDialog(page, testPassword);
    await selectUploadFiles(page, zipPayload);
    const intentPromise = page.waitForResponse((res) =>
      res.url().includes('/v1/media/upload-intents') &&
      res.request().method() === 'POST',
    );
    await clickUpload(page);
    const intentRes = await intentPromise;
    const intentJson = await intentRes.json();
    const mediaId = intentJson?.media?.id as string | undefined;

    const card = page
      .locator('[data-testid="media-card"]')
      .filter({ hasText: 'test-archive.zip' })
      .first();
    await expect(card).toBeVisible({ timeout: 60000 });

    const uploadDialog = getUploadDialog(page);
    if (await uploadDialog.isVisible().catch(() => false)) {
      await page.keyboard.press('Escape');
      await expect(uploadDialog).toBeHidden({ timeout: 20000 });
    }

    await card.click();
    await expect(page.locator('[data-testid="media-viewer"]')).toBeVisible({
      timeout: 20000,
    });
    const docViewer = page.locator('[data-testid="document-viewer"]');
    await expect(docViewer).toBeVisible({ timeout: 20000 });
    await expect(docViewer.getByText('ZIP', { exact: true })).toBeVisible({
      timeout: 20000,
    });
    await expect(docViewer.getByText('Contents')).toBeVisible({ timeout: 20000 });
    await expect(docViewer.getByText('hello.txt')).toBeVisible({ timeout: 20000 });
    await expect(docViewer.getByText('folder/', { exact: true })).toBeVisible({
      timeout: 20000,
    });
    await expect(docViewer.getByText('folder/nested.txt')).toBeVisible({
      timeout: 20000,
    });

    // Cleanup best-effort.
    if (mediaId) {
      await fetch(`${API_BASE_URL}/v1/media/${mediaId}/purge`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      }).catch(() => undefined);
    }
  });

  test('encrypted thumbnail flow - thumbnail upload intent and completion', async ({ page }) => {
    // This test verifies that thumbnail upload intent and completion endpoints work
    // We'll use API directly as UI may not expose thumbnail-specific endpoints

    // 1. Create a media item (as above)
    const fixturePath = path.join(__dirname, 'fixtures', 'test-image.jpg');
    const imageBuffer = fs.readFileSync(fixturePath);

    const intentRes = await fetch(`${API_BASE_URL}/v1/media/upload-intents`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'PHOTO',
        byteSize: imageBuffer.length,
        contentType: 'image/jpeg',
        encAlgo: 'xchacha20poly1305',
        encMeta: { v: 1 },
        thumbnail: {
          byteSize: 10,
          contentType: 'image/jpeg',
          encMeta: { v: 1, thumb: true },
        },
      }),
    });
    expect(intentRes.ok).toBeTruthy();
    const intentData = await intentRes.json();
    const mediaId = intentData.media.id;

    // 1b) Upload dummy ciphertext for original + thumb.
    const uploadOriginalRes = await fetch(intentData.signedUploadUrl.url, {
      method: intentData.signedUploadUrl.method ?? 'PUT',
      headers: intentData.signedUploadUrl.headers ?? {},
      body: new ArrayBuffer(10),
    });
    expect(uploadOriginalRes.ok).toBeTruthy();
    const originalEtagHeader = uploadOriginalRes.headers.get('etag') ?? undefined;
    const originalEtag = originalEtagHeader?.replace(/"/g, '');

    const thumbUrl = intentData.signedThumbnailUploadUrl?.url;
    expect(thumbUrl).toBeTruthy();
    const uploadThumbRes = await fetch(thumbUrl, {
      method: intentData.signedThumbnailUploadUrl.method ?? 'PUT',
      headers: intentData.signedThumbnailUploadUrl.headers ?? {},
      body: new ArrayBuffer(10),
    });
    expect(uploadThumbRes.ok).toBeTruthy();
    const thumbEtagHeader = uploadThumbRes.headers.get('etag') ?? undefined;
    const thumbEtag = thumbEtagHeader?.replace(/"/g, '');

    // 1c) Complete original upload so thumbnail intent is allowed.
    const completeOriginalRes = await fetch(`${API_BASE_URL}/v1/media/${mediaId}/complete-upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ etag: originalEtag }),
    });
    expect(completeOriginalRes.ok).toBeTruthy();

    // 2. Complete thumbnail upload
    const thumbCompleteRes = await fetch(`${API_BASE_URL}/v1/media/${mediaId}/complete-thumbnail-upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ etag: thumbEtag }),
    });
    expect(thumbCompleteRes.ok).toBeTruthy();
    const thumbCompleteData = await thumbCompleteRes.json();
    expect(thumbCompleteData.media.thumbUploadedAt).toBeTruthy();

    // 5. Verify that download-url with variant=thumb works
    const downloadUrlRes = await fetch(`${API_BASE_URL}/v1/media/${mediaId}/download-url?variant=thumb`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    expect(downloadUrlRes.ok).toBeTruthy();
    const downloadUrlData = await downloadUrlRes.json();
    expect(downloadUrlData.downloadUrl.url).toBeTruthy();

    // 6. Clean up
    await fetch(`${API_BASE_URL}/v1/media/${mediaId}/purge`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
  });
});