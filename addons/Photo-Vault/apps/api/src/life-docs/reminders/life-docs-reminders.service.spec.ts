import { LifeDocReminderKind, LifeDocReminderSetting, LifeDocStatus } from "@prisma/client";
import { LifeDocsRemindersService } from "./life-docs-reminders.service";
import { LifeDocsCryptoService } from "../life-docs.crypto.service";

function b64(bytes: number): string {
  return Buffer.alloc(bytes, 9).toString("base64");
}

describe("LifeDocsRemindersService", () => {
  let prisma: any;
  let crypto: LifeDocsCryptoService;
  let service: LifeDocsRemindersService;
  let mail: any;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-02-11T10:00:00.000Z"));

    prisma = {
      lifeDoc: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      user: { findUnique: jest.fn() },
      media: { findUnique: jest.fn() },
      lifeDocReminderSent: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      lifeDocReminderEvent: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      notificationEvent: { create: jest.fn() },
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
    };

    const configStub: any = {
      lifeDocsSealingKeyBase64: b64(32),
      lifeDocsAccessHmacKeyBase64: b64(32),
      webAppUrl: "http://localhost:3000",
    };

    mail = {
      sendLifeDocReminderEmail: jest.fn().mockResolvedValue(undefined),
    };

    crypto = new LifeDocsCryptoService(configStub);
    service = new LifeDocsRemindersService(prisma, crypto, mail, configStub);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("emits a single reminder for owner by default and dedupes idempotently", async () => {
    const ownerId = "11111111-1111-1111-1111-111111111111";
    const mediaId = "22222222-2222-2222-2222-222222222222";

    prisma.lifeDoc.findMany.mockResolvedValue([
      {
        id: "doc-1",
        ownerId,
        title: "Passport",
        category: "IDENTITY_LEGAL",
        subcategory: "PASSPORT",
        // Stored as UTC instant for start-of-day in owner's timezone (IST): 2026-05-12T00:00:00+05:30
        expiryDate: new Date("2026-05-11T18:30:00.000Z"),
        reminderSetting: LifeDocReminderSetting.EXPIRY_DEFAULT,
        reminderCustomDays: null,
        quietHoursStart: null,
        quietHoursEnd: null,
        maskedMode: false,
        maskedHideExpiry: false,
        aliasTitle: null,
        visibility: "PRIVATE",
        accessRoles: crypto.sealJson({ sharedMembers: [], guardians: [], notifySharedMembers: false }),
        vaultObjectId: crypto.sealJson({ mediaId }),
        fileHash: b64(32),
        status: LifeDocStatus.ACTIVE,
      },
    ]);

    prisma.lifeDoc.findUnique.mockResolvedValue({
      id: "doc-1",
      ownerId,
      quietHoursStart: null,
      quietHoursEnd: null,
      lastRemindedAt: null,
    });

    prisma.user.findUnique.mockImplementation(async (args: any) => {
      if (args?.select?.timezone) return { id: ownerId, timezone: "Asia/Kolkata" };
      if (args?.select?.email) return { email: "owner@example.com" };
      return null;
    });

    prisma.media.findUnique.mockResolvedValue({
      id: mediaId,
      userId: ownerId,
      sha256Ciphertext: Buffer.from(Buffer.from(b64(32), "base64")),
    });

    prisma.lifeDocReminderSent.findUnique.mockResolvedValue(null);

    const sentAt = new Date("2026-02-11T10:00:00.000Z");
    let inAppFindCalls = 0;
    prisma.lifeDocReminderEvent.findUnique.mockImplementation(async (args: any) => {
      const key = args?.where?.dedupeKey as string;
      if (key?.endsWith("|email")) return null;
      inAppFindCalls += 1;
      if (inAppFindCalls === 1) return null;
      return { id: "evt-1", sentAt, scheduledFor: sentAt };
    });

    prisma.notificationEvent.create.mockResolvedValue({ id: "n-1" });

    const first = await service.scanAndEmitDueReminders();
    expect(first.emitted).toBe(1);

    expect(mail.sendLifeDocReminderEmail).toHaveBeenCalledTimes(1);

    const second = await service.scanAndEmitDueReminders();
    expect(second.emitted).toBe(0);

    expect(mail.sendLifeDocReminderEmail).toHaveBeenCalledTimes(1);

    expect(prisma.notificationEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: ownerId,
          type: "LIFE_DOC_EXPIRY_REMINDER",
          payload: expect.objectContaining({
            kind: LifeDocReminderKind.D90,
          }),
        }),
      }),
    );
  });

  it("defers reminders during quiet hours without emitting notifications", async () => {
    const ownerId = "11111111-1111-1111-1111-111111111111";
    const mediaId = "22222222-2222-2222-2222-222222222222";

    prisma.lifeDoc.findMany.mockResolvedValue([
      {
        id: "doc-1",
        ownerId,
        title: "Passport",
        category: "IDENTITY_LEGAL",
        subcategory: "PASSPORT",
        expiryDate: new Date("2026-05-11T18:30:00.000Z"),
        reminderSetting: LifeDocReminderSetting.EXPIRY_DEFAULT,
        reminderCustomDays: null,
        quietHoursStart: "15:00",
        quietHoursEnd: "16:00",
        maskedMode: false,
        maskedHideExpiry: false,
        aliasTitle: null,
        visibility: "PRIVATE",
        accessRoles: crypto.sealJson({ sharedMembers: [], guardians: [], notifySharedMembers: false }),
        vaultObjectId: crypto.sealJson({ mediaId }),
        fileHash: b64(32),
        status: LifeDocStatus.ACTIVE,
      },
    ]);

    prisma.lifeDoc.findUnique.mockResolvedValue({
      id: "doc-1",
      ownerId,
      quietHoursStart: "15:00",
      quietHoursEnd: "16:00",
      lastRemindedAt: null,
    });

    prisma.user.findUnique.mockImplementation(async (args: any) => {
      if (args?.select?.timezone) return { id: ownerId, timezone: "Asia/Kolkata" };
      if (args?.select?.email) return { email: "owner@example.com" };
      return null;
    });

    prisma.media.findUnique.mockResolvedValue({
      id: mediaId,
      userId: ownerId,
      sha256Ciphertext: Buffer.from(Buffer.from(b64(32), "base64")),
    });

    prisma.lifeDocReminderSent.findUnique.mockResolvedValue(null);
    prisma.lifeDocReminderEvent.findUnique.mockResolvedValue(null);
    prisma.notificationEvent.create.mockResolvedValue({ id: "n-1" });

    const res = await service.scanAndEmitDueReminders();
    expect(res.emitted).toBe(0);

    expect(prisma.lifeDocReminderEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lifeDocId: "doc-1",
          kind: LifeDocReminderKind.D90,
          sentAt: null,
          scheduledFor: new Date("2026-02-11T10:30:00.000Z"),
        }),
      }),
    );

    expect(prisma.notificationEvent.create).not.toHaveBeenCalled();

    expect(mail.sendLifeDocReminderEmail).not.toHaveBeenCalled();
  });

  it("sends masked reminder email using alias title and hides expiry when configured", async () => {
    const ownerId = "11111111-1111-1111-1111-111111111111";
    const mediaId = "22222222-2222-2222-2222-222222222222";

    prisma.lifeDoc.findMany.mockResolvedValue([
      {
        id: "doc-1",
        ownerId,
        title: "Passport",
        category: "IDENTITY_LEGAL",
        subcategory: "PASSPORT",
        expiryDate: new Date("2026-05-11T18:30:00.000Z"),
        reminderSetting: LifeDocReminderSetting.EXPIRY_DEFAULT,
        reminderCustomDays: null,
        quietHoursStart: null,
        quietHoursEnd: null,
        maskedMode: true,
        maskedHideExpiry: true,
        aliasTitle: "Family Passport",
        visibility: "PRIVATE",
        accessRoles: crypto.sealJson({ sharedMembers: [], guardians: [], notifySharedMembers: false }),
        vaultObjectId: crypto.sealJson({ mediaId }),
        fileHash: b64(32),
        status: LifeDocStatus.ACTIVE,
      },
    ]);

    prisma.lifeDoc.findUnique.mockResolvedValue({
      id: "doc-1",
      ownerId,
      quietHoursStart: null,
      quietHoursEnd: null,
      lastRemindedAt: null,
    });

    prisma.user.findUnique.mockImplementation(async (args: any) => {
      if (args?.select?.timezone) return { id: ownerId, timezone: "Asia/Kolkata" };
      if (args?.select?.email) return { email: "owner@example.com" };
      return null;
    });

    prisma.media.findUnique.mockResolvedValue({
      id: mediaId,
      userId: ownerId,
      sha256Ciphertext: Buffer.from(Buffer.from(b64(32), "base64")),
    });

    prisma.lifeDocReminderSent.findUnique.mockResolvedValue(null);

    // First run should send; email event exists with sentAt null.
    let inAppFindCalls = 0;
    prisma.lifeDocReminderEvent.findUnique.mockImplementation(async (args: any) => {
      const key = args?.where?.dedupeKey as string;
      if (key?.endsWith("|email")) return { id: "email-evt-1", sentAt: null };
      inAppFindCalls += 1;
      if (inAppFindCalls === 1) return null;
      return { id: "evt-1", sentAt: new Date("2026-02-11T10:00:00.000Z"), scheduledFor: new Date("2026-02-11T10:00:00.000Z") };
    });

    prisma.notificationEvent.create.mockResolvedValue({ id: "n-1" });

    const res = await service.scanAndEmitDueReminders();
    expect(res.emitted).toBe(1);

    expect(mail.sendLifeDocReminderEmail).toHaveBeenCalledWith(
      "owner@example.com",
      expect.objectContaining({
        lifeDocId: "doc-1",
        title: "Family Passport",
        expiryDateIso: null,
        masked: true,
        maskedHideExpiry: true,
      }),
    );

    // Marks email event as sent.
    expect(prisma.lifeDocReminderEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ dedupeKey: expect.stringContaining("|email") }),
        data: expect.objectContaining({ sentAt: expect.any(Date) }),
      }),
    );
  });
});
