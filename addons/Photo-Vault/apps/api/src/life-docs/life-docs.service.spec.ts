import { ForbiddenException, NotFoundException } from "@nestjs/common";
import {
  LifeDocAccessGrantKind,
  LifeDocAccessRole,
  LifeDocReminderSetting,
  LifeDocRenewalState,
  LifeDocStatus,
  LifeDocVisibility,
  MediaType,
} from "@prisma/client";
import { LifeDocsService } from "./life-docs.service";
import { LifeDocsCryptoService } from "./life-docs.crypto.service";

function b64(bytes: number): string {
  return Buffer.alloc(bytes, 7).toString("base64");
}

describe("LifeDocsService", () => {
  const ownerId = "11111111-1111-1111-1111-111111111111";
  const guardianId = "22222222-2222-2222-2222-222222222222";
  const otherUserId = "33333333-3333-3333-3333-333333333333";
  const mediaId = "44444444-4444-4444-4444-444444444444";

  let prisma: any;
  let crypto: LifeDocsCryptoService;
  let service: LifeDocsService;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn() },
      media: { findUnique: jest.fn() },
      auditEvent: { create: jest.fn() },
      lifeDoc: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      lifeDocAccessGrant: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
        findMany: jest.fn(),
      },
      lifeDocReminderSent: {
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
    };

    const configStub: any = {
      lifeDocsSealingKeyBase64: b64(32),
      lifeDocsAccessHmacKeyBase64: b64(32),
    };

    crypto = new LifeDocsCryptoService(configStub);
    service = new LifeDocsService(prisma, crypto);
  });

  it("denies access when user is neither owner nor granted", async () => {
    const vaultObjectId = crypto.sealJson({ mediaId });

    prisma.lifeDoc.findUnique.mockResolvedValue({
      id: "doc-1",
      ownerId,
      category: "IDENTITY_LEGAL",
      subcategory: "PASSPORT",
      title: "Passport",
      issuingAuthority: null,
      issueDate: null,
      expiryDate: null,
      renewalRequired: false,
      reminderSetting: LifeDocReminderSetting.EXPIRY_DEFAULT,
      visibility: LifeDocVisibility.PRIVATE,
      accessRoles: crypto.sealJson({ sharedMembers: [], guardians: [], notifySharedMembers: false }),
      status: LifeDocStatus.ACTIVE,
      versionGroupId: "vg-1",
      fileHash: "hash",
      uploadTimestamp: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      vaultObjectId,
      accessGrants: [],
      owner: { timezone: "Asia/Kolkata" },
    });

    await expect(service.getById(otherUserId, "doc-1")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("allows guardian-granted viewer access and logs owner-visible access event", async () => {
    const vaultObjectId = crypto.sealJson({ mediaId });
    const grantHash = crypto.hmacUserId(guardianId);

    prisma.lifeDoc.findUnique.mockResolvedValue({
      id: "doc-1",
      ownerId,
      category: "IDENTITY_LEGAL",
      subcategory: "PASSPORT",
      title: "Passport",
      issuingAuthority: null,
      issueDate: null,
      expiryDate: null,
      renewalRequired: false,
      reminderSetting: LifeDocReminderSetting.EXPIRY_DEFAULT,
      visibility: LifeDocVisibility.GUARDIAN_ACCESSIBLE,
      accessRoles: crypto.sealJson({ sharedMembers: [], guardians: [{ userId: guardianId, role: LifeDocAccessRole.VIEWER }], notifySharedMembers: false }),
      status: LifeDocStatus.ACTIVE,
      versionGroupId: "vg-1",
      fileHash: b64(32),
      uploadTimestamp: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      vaultObjectId,
      accessGrants: [
        {
          kind: LifeDocAccessGrantKind.GUARDIAN,
          granteeHash: grantHash,
          role: LifeDocAccessRole.VIEWER,
        },
      ],
      owner: { timezone: "Asia/Kolkata" },
    });

    prisma.media.findUnique.mockResolvedValue({
      id: mediaId,
      userId: ownerId,
      type: MediaType.DOCUMENT,
      sha256Ciphertext: Buffer.from(Buffer.from(b64(32), "base64")),
      uploadedAt: new Date(),
      createdAt: new Date(),
    });

    prisma.lifeDoc.findFirst.mockResolvedValue({ id: "doc-1" });

    const res = await service.getById(guardianId, "doc-1");

    expect(res.viewerRole).toBe(LifeDocAccessRole.VIEWER);
    expect(prisma.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: ownerId,
        eventType: "LIFE_DOC_ACCESSED",
        entityType: "LIFE_DOC",
        entityId: "doc-1",
      }),
    });
  });

  it("fails closed when vault reference is missing", async () => {
    const vaultObjectId = crypto.sealJson({ mediaId });

    prisma.lifeDoc.findUnique.mockResolvedValue({
      id: "doc-1",
      ownerId,
      category: "IDENTITY_LEGAL",
      subcategory: "PASSPORT",
      title: "Passport",
      issuingAuthority: null,
      issueDate: null,
      expiryDate: null,
      renewalRequired: false,
      reminderSetting: LifeDocReminderSetting.EXPIRY_DEFAULT,
      visibility: LifeDocVisibility.PRIVATE,
      accessRoles: crypto.sealJson({ sharedMembers: [], guardians: [], notifySharedMembers: false }),
      status: LifeDocStatus.ACTIVE,
      versionGroupId: "vg-1",
      fileHash: b64(32),
      uploadTimestamp: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      vaultObjectId,
      accessGrants: [],
      owner: { timezone: "Asia/Kolkata" },
    });

    // Owner can read, but media is missing.
    prisma.media.findUnique.mockResolvedValue(null);

    await expect(service.getById(ownerId, "doc-1")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("replace keeps version group id and requires manage permissions", async () => {
    const existing = {
      id: "doc-1",
      ownerId,
      category: "IDENTITY_LEGAL",
      subcategory: "PASSPORT",
      title: "Passport",
      issuingAuthority: null,
      issueDate: null,
      expiryDate: null,
      renewalRequired: false,
      reminderSetting: LifeDocReminderSetting.EXPIRY_DEFAULT,
      visibility: LifeDocVisibility.PRIVATE,
      accessRoles: crypto.sealJson({ sharedMembers: [], guardians: [{ userId: guardianId, role: LifeDocAccessRole.MANAGER }], notifySharedMembers: false }),
      status: LifeDocStatus.ACTIVE,
      versionGroupId: "vg-1",
      fileHash: b64(32),
      uploadTimestamp: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      vaultObjectId: crypto.sealJson({ mediaId }),
      accessGrants: [
        {
          kind: LifeDocAccessGrantKind.GUARDIAN,
          granteeHash: crypto.hmacUserId(guardianId),
          role: LifeDocAccessRole.MANAGER,
        },
      ],
      owner: { timezone: "Asia/Kolkata" },
    };

    prisma.lifeDoc.findUnique.mockResolvedValue(existing);
    prisma.user.findUnique.mockResolvedValue({ id: ownerId, timezone: "Asia/Kolkata" });

    prisma.media.findUnique.mockResolvedValue({
      id: "new-media",
      userId: ownerId,
      type: MediaType.DOCUMENT,
      sha256Ciphertext: Buffer.from(Buffer.from(b64(32), "base64")),
      uploadedAt: new Date(),
      createdAt: new Date(),
    });

    prisma.lifeDoc.create.mockResolvedValue({
      ...existing,
      id: "doc-2",
      vaultObjectId: crypto.sealJson({ mediaId: "new-media" }),
      accessGrants: [],
    });

    prisma.media.findUnique.mockResolvedValueOnce({
      id: "new-media",
      userId: ownerId,
      type: MediaType.DOCUMENT,
      sha256Ciphertext: Buffer.from(Buffer.from(b64(32), "base64")),
      uploadedAt: new Date(),
      createdAt: new Date(),
    });

    const res = await service.replace(guardianId, "doc-1", { mediaId: "new-media" } as any);

    expect(prisma.lifeDoc.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          versionGroupId: "vg-1",
        }),
      }),
    );
    expect(res.versionGroupId).toBe("vg-1");
  });

  it("timeline groups by expiry month and respects horizon/filtering", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-02-12T00:00:00.000Z"));

    const listSpy = jest.spyOn(service as any, "list").mockResolvedValue({
      items: [
        {
          id: "a",
          ownerId,
          ownerDisplayName: "Owner",
          category: "IDENTITY_LEGAL",
          subcategory: "PASSPORT",
          customSubcategory: null,
          title: "A",
          issuingAuthority: null,
          issueDate: null,
          expiryDate: "2026-03-10",
          renewalRequired: false,
          renewalState: LifeDocRenewalState.NOT_REQUIRED,
          reminderSetting: LifeDocReminderSetting.EXPIRY_DEFAULT,
          reminderCustomDays: null,
          quietHours: null,
          notifySharedMembers: false,
          lastRemindedAt: null,
          visibility: "PRIVATE",
          status: "ACTIVE",
          versionGroupId: "vg",
          fileHash: "h",
          uploadTimestamp: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          vaultMediaId: "m",
          viewerRole: LifeDocAccessRole.OWNER,
        },
        {
          id: "b",
          ownerId,
          ownerDisplayName: "Owner",
          category: "IDENTITY_LEGAL",
          subcategory: "PASSPORT",
          customSubcategory: null,
          title: "B",
          issuingAuthority: null,
          issueDate: null,
          expiryDate: "2026-03-01",
          renewalRequired: false,
          renewalState: LifeDocRenewalState.NOT_REQUIRED,
          reminderSetting: LifeDocReminderSetting.EXPIRY_DEFAULT,
          reminderCustomDays: null,
          quietHours: null,
          notifySharedMembers: false,
          lastRemindedAt: null,
          visibility: "PRIVATE",
          status: "EXPIRING_SOON",
          versionGroupId: "vg",
          fileHash: "h",
          uploadTimestamp: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          vaultMediaId: "m",
          viewerRole: LifeDocAccessRole.OWNER,
        },
        {
          id: "c",
          ownerId,
          ownerDisplayName: "Owner",
          category: "IDENTITY_LEGAL",
          subcategory: "PASSPORT",
          customSubcategory: null,
          title: "C",
          issuingAuthority: null,
          issueDate: null,
          expiryDate: "2026-05-01", // beyond 2-month horizon
          renewalRequired: false,
          renewalState: LifeDocRenewalState.NOT_REQUIRED,
          reminderSetting: LifeDocReminderSetting.EXPIRY_DEFAULT,
          reminderCustomDays: null,
          quietHours: null,
          notifySharedMembers: false,
          lastRemindedAt: null,
          visibility: "PRIVATE",
          status: "ACTIVE",
          versionGroupId: "vg",
          fileHash: "h",
          uploadTimestamp: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          vaultMediaId: "m",
          viewerRole: LifeDocAccessRole.OWNER,
        },
        {
          id: "no-exp",
          ownerId,
          ownerDisplayName: "Owner",
          category: "IDENTITY_LEGAL",
          subcategory: "PASSPORT",
          customSubcategory: null,
          title: "No",
          issuingAuthority: null,
          issueDate: null,
          expiryDate: null,
          renewalRequired: false,
          renewalState: LifeDocRenewalState.NOT_REQUIRED,
          reminderSetting: LifeDocReminderSetting.EXPIRY_DEFAULT,
          reminderCustomDays: null,
          quietHours: null,
          notifySharedMembers: false,
          lastRemindedAt: null,
          visibility: "PRIVATE",
          status: "ACTIVE",
          versionGroupId: "vg",
          fileHash: "h",
          uploadTimestamp: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          vaultMediaId: "m",
          viewerRole: LifeDocAccessRole.OWNER,
        },
      ],
    });

    const res = await service.getTimeline({ userId: ownerId, months: 2, status: "EXPIRING" });

    expect(res.months).toBe(2);
    expect(res.groups).toHaveLength(1);
    expect(res.groups[0].month).toBe("2026-03");
    // Sorted by expiry asc (b then a)
    expect(res.groups[0].items.map((i: any) => i.id)).toEqual(["b"]);

    listSpy.mockRestore();
    jest.useRealTimers();
  });

  it("search filters by owner/category and matches metadata fields", async () => {
    const listSpy = jest.spyOn(service as any, "list").mockResolvedValue({
      items: [
        {
          id: "d1",
          ownerId,
          ownerDisplayName: "Owner",
          category: "IDENTITY_LEGAL",
          subcategory: "CUSTOM",
          customSubcategory: "Residency Permit",
          title: "Permit",
          issuingAuthority: "Gov",
          issueDate: null,
          expiryDate: "2026-12-01",
          renewalRequired: false,
          reminderSetting: LifeDocReminderSetting.EXPIRY_DEFAULT,
          visibility: "PRIVATE",
          status: "ACTIVE",
          versionGroupId: "vg",
          fileHash: "h",
          uploadTimestamp: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          vaultMediaId: "m",
          viewerRole: LifeDocAccessRole.OWNER,
        },
        {
          id: "d2",
          ownerId: otherUserId,
          ownerDisplayName: "Other",
          category: "IDENTITY_LEGAL",
          subcategory: "PASSPORT",
          customSubcategory: null,
          title: "Passport",
          issuingAuthority: null,
          issueDate: null,
          expiryDate: "2026-12-01",
          renewalRequired: false,
          reminderSetting: LifeDocReminderSetting.EXPIRY_DEFAULT,
          visibility: "PRIVATE",
          status: "ACTIVE",
          versionGroupId: "vg",
          fileHash: "h",
          uploadTimestamp: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          vaultMediaId: "m",
          viewerRole: LifeDocAccessRole.VIEWER,
        },
      ],
    });

    const res = await service.search({
      userId: ownerId,
      q: "residency",
      ownerId,
      category: "IDENTITY_LEGAL",
    });

    expect(res.items.map((i: any) => i.id)).toEqual(["d1"]);
    listSpy.mockRestore();
  });

  it("family overview counts guardian-expiring docs only when guardian grant exists", async () => {
    prisma.lifeDocAccessGrant.findMany.mockResolvedValue([
      { lifeDocId: "child-1" },
    ]);

    const listSpy = jest.spyOn(service as any, "list").mockResolvedValue({
      items: [
        {
          id: "mine",
          ownerId,
          viewerRole: LifeDocAccessRole.OWNER,
          status: LifeDocStatus.EXPIRING_SOON,
          renewalState: LifeDocRenewalState.NOT_REQUIRED,
        },
        {
          id: "child-1",
          ownerId: otherUserId,
          viewerRole: LifeDocAccessRole.VIEWER,
          status: LifeDocStatus.EXPIRING_SOON,
          renewalState: LifeDocRenewalState.NOT_REQUIRED,
        },
        {
          id: "shared-viewer",
          ownerId: otherUserId,
          viewerRole: LifeDocAccessRole.VIEWER,
          status: LifeDocStatus.ACTIVE,
          renewalState: LifeDocRenewalState.UPCOMING,
        },
        {
          id: "shared-manager",
          ownerId: otherUserId,
          viewerRole: LifeDocAccessRole.MANAGER,
          status: LifeDocStatus.ACTIVE,
          renewalState: LifeDocRenewalState.UPCOMING,
        },
      ],
    });

    const res = await service.getFamilyOverview(ownerId);
    expect(res.myExpiringSoon).toBe(1);
    expect(res.sharedWithMe).toBe(3);
    expect(res.childrenExpiringSoon).toBe(1);
    // viewerRole VIEWER for shared doc is excluded from needsRenewal
    expect(res.needsRenewal).toBe(1);

    listSpy.mockRestore();
  });

  it("restoreVersion denies when version does not belong to same version group", async () => {
    prisma.lifeDoc.findUnique
      .mockResolvedValueOnce({
        id: "doc-1",
        ownerId,
        versionGroupId: "vg-1",
        accessGrants: [],
        owner: { timezone: "Asia/Kolkata", displayName: "Owner" },
      })
      .mockResolvedValueOnce({
        id: "ver-2",
        ownerId,
        versionGroupId: "vg-OTHER",
        vaultObjectId: "bad",
        fileHash: "h2",
        accessGrants: [],
        owner: { timezone: "Asia/Kolkata", displayName: "Owner" },
      });

    await expect(service.restoreVersion(ownerId, "doc-1", "ver-2")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("restoreVersion fails closed when vault reference is invalid", async () => {
    prisma.lifeDoc.findUnique
      .mockResolvedValueOnce({
        id: "doc-1",
        ownerId,
        versionGroupId: "vg-1",
        accessGrants: [],
        owner: { timezone: "Asia/Kolkata", displayName: "Owner" },
      })
      .mockResolvedValueOnce({
        id: "ver-1",
        ownerId,
        versionGroupId: "vg-1",
        vaultObjectId: "not-sealed",
        fileHash: "h2",
        accessGrants: [],
        owner: { timezone: "Asia/Kolkata", displayName: "Owner" },
      });

    prisma.lifeDoc.findFirst.mockResolvedValue({
      id: "latest",
      ownerId,
      versionGroupId: "vg-1",
      category: "IDENTITY_LEGAL",
      subcategory: "PASSPORT",
      customSubcategory: null,
      title: "Latest",
      issuingAuthority: null,
      issueDate: null,
      expiryDate: null,
      renewalRequired: false,
      renewalState: LifeDocRenewalState.NOT_REQUIRED,
      reminderSetting: LifeDocReminderSetting.EXPIRY_DEFAULT,
      reminderCustomDays: [],
      quietHoursStart: null,
      quietHoursEnd: null,
      notifySharedMembers: false,
      maskedMode: false,
      maskedHideExpiry: true,
      aliasTitle: null,
      visibility: LifeDocVisibility.PRIVATE,
      accessRoles: crypto.sealJson({ sharedMembers: [], guardians: [], notifySharedMembers: false }),
      accessGrants: [],
      fileHash: "h",
      uploadTimestamp: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      owner: { timezone: "Asia/Kolkata", displayName: "Owner" },
    });

    await expect(service.restoreVersion(ownerId, "doc-1", "ver-1")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("restoreVersion creates a new latest doc using latest metadata and target file hash", async () => {
    const verifySpy = jest
      .spyOn(service as any, "verifyVaultIntegrityOrThrow")
      .mockResolvedValue({ uploadedAt: new Date("2026-02-11T10:00:00.000Z") });

    prisma.lifeDoc.findUnique
      .mockResolvedValueOnce({
        id: "doc-1",
        ownerId,
        versionGroupId: "vg-1",
        accessGrants: [],
        owner: { timezone: "Asia/Kolkata", displayName: "Owner" },
      })
      .mockResolvedValueOnce({
        id: "ver-1",
        ownerId,
        versionGroupId: "vg-1",
        vaultObjectId: crypto.sealJson({ mediaId }),
        fileHash: "TARGET_HASH",
        accessGrants: [],
        owner: { timezone: "Asia/Kolkata", displayName: "Owner" },
      });

    prisma.lifeDoc.findFirst.mockResolvedValue({
      id: "latest",
      ownerId,
      versionGroupId: "vg-1",
      category: "IDENTITY_LEGAL",
      subcategory: "PASSPORT",
      customSubcategory: null,
      title: "LATEST_TITLE",
      issuingAuthority: "AUTH",
      issueDate: null,
      expiryDate: null,
      renewalRequired: false,
      renewalState: LifeDocRenewalState.NOT_REQUIRED,
      reminderSetting: LifeDocReminderSetting.EXPIRY_DEFAULT,
      reminderCustomDays: [],
      quietHoursStart: null,
      quietHoursEnd: null,
      notifySharedMembers: false,
      maskedMode: false,
      maskedHideExpiry: true,
      aliasTitle: null,
      visibility: LifeDocVisibility.PRIVATE,
      accessRoles: crypto.sealJson({ sharedMembers: [], guardians: [], notifySharedMembers: false }),
      accessGrants: [],
      fileHash: "LATEST_HASH",
      uploadTimestamp: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      owner: { timezone: "Asia/Kolkata", displayName: "Owner" },
    });

    prisma.lifeDoc.create.mockResolvedValue({
      id: "restored",
      ownerId,
      versionGroupId: "vg-1",
      vaultObjectId: crypto.sealJson({ mediaId }),
      category: "IDENTITY_LEGAL",
      subcategory: "PASSPORT",
      customSubcategory: null,
      title: "LATEST_TITLE",
      issuingAuthority: "AUTH",
      issueDate: null,
      expiryDate: null,
      renewalRequired: false,
      renewalState: LifeDocRenewalState.NOT_REQUIRED,
      reminderSetting: LifeDocReminderSetting.EXPIRY_DEFAULT,
      reminderCustomDays: [],
      quietHoursStart: null,
      quietHoursEnd: null,
      notifySharedMembers: false,
      maskedMode: false,
      maskedHideExpiry: true,
      aliasTitle: null,
      visibility: LifeDocVisibility.PRIVATE,
      accessRoles: crypto.sealJson({ sharedMembers: [], guardians: [], notifySharedMembers: false }),
      accessGrants: [],
      status: LifeDocStatus.ACTIVE,
      fileHash: "TARGET_HASH",
      uploadTimestamp: new Date("2026-02-11T10:00:00.000Z"),
      createdAt: new Date(),
      updatedAt: new Date(),
      owner: { timezone: "Asia/Kolkata", displayName: "Owner" },
    });

    await service.restoreVersion(ownerId, "doc-1", "ver-1");

    expect(prisma.lifeDoc.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "LATEST_TITLE",
          fileHash: "TARGET_HASH",
        }),
      }),
    );

    verifySpy.mockRestore();
  });
});
