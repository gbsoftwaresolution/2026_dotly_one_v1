import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  LifeDocAccessGrantKind,
  LifeDocAccessRole,
  LifeDocRenewalState,
  LifeDocSubcategory,
  LifeDocReminderSetting,
  LifeDocStatus,
  LifeDocVisibility,
  MediaType,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { LifeDocsCryptoService } from "./life-docs.crypto.service";
import { defaultAclPayload, LifeDocAclPayload } from "./life-docs.acl";
import {
  computeAutoStatus,
  computeDaysUntilExpiry,
  parseIsoDateToUtcStart,
  toUserDateIso,
} from "./life-docs.status";
import { randomUUID } from "crypto";
import {
  CreateLifeDocDto,
  LifeDocAccessRolesInput,
  LifeDocRenewalState as SharedLifeDocRenewalState,
  LifeDocsFamilyOverviewResponse,
  LifeDocsRenewalSummaryResponse,
  LifeDocsSearchResponse,
  LifeDocsTimelineResponse,
  LifeDocResponse,
  LifeDocListResponse,
  LifeDocVersionsResponse,
  ReplaceLifeDocDto,
  SetLifeDocRenewalStateDto,
  UpdateLifeDocMaskedPrivacyDto,
  UpdateLifeDocRemindersDto,
  UpdateLifeDocDto,
} from "@booster-vault/shared";

type VaultPointerPayload = {
  mediaId: string;
};

@Injectable()
export class LifeDocsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: LifeDocsCryptoService,
  ) {}

  private normalizeAclInput(input?: LifeDocAccessRolesInput): LifeDocAclPayload {
    const acl = defaultAclPayload();
    if (!input) return acl;

    if (typeof input.notifySharedMembers === "boolean") {
      acl.notifySharedMembers = input.notifySharedMembers;
    }

    const mapMembers = (members?: any[]) => {
      if (!members) return [];

      const out: { userId: string; role: "VIEWER" | "MANAGER" }[] = [];

      for (const m of members) {
        const userId = String((m as any)?.userId ?? "");
        if (!userId) continue;

        const roleRaw = String((m as any)?.role ?? "");
        if (roleRaw === "OWNER") {
          throw new BadRequestException("OWNER role cannot be granted");
        }
        if (roleRaw !== "VIEWER" && roleRaw !== "MANAGER") {
          throw new BadRequestException("Invalid access role");
        }

        out.push({ userId, role: roleRaw });
      }

      return out;
    };

    acl.sharedMembers = mapMembers(input.sharedMembers);
    acl.guardians = mapMembers(input.guardians);

    return acl;
  }

  private async syncAccessGrants(
    tx: Prisma.TransactionClient,
    lifeDocId: string,
    acl: LifeDocAclPayload,
  ): Promise<void> {
    const grants: Prisma.LifeDocAccessGrantCreateManyInput[] = [];

    for (const member of acl.sharedMembers) {
      grants.push({
        lifeDocId,
        kind: LifeDocAccessGrantKind.SHARED,
        granteeHash: this.crypto.hmacUserId(member.userId),
        role: member.role as any,
      });
    }
    for (const member of acl.guardians) {
      grants.push({
        lifeDocId,
        kind: LifeDocAccessGrantKind.GUARDIAN,
        granteeHash: this.crypto.hmacUserId(member.userId),
        role: member.role as any,
      });
    }

    // Replace grants set.
    await tx.lifeDocAccessGrant.deleteMany({ where: { lifeDocId } });
    if (grants.length > 0) {
      await tx.lifeDocAccessGrant.createMany({ data: grants });
    }
  }

  private getViewerRoleOrNull(
    userId: string,
    ownerId: string,
    grants: Array<{ kind: LifeDocAccessGrantKind; granteeHash: string; role: LifeDocAccessRole }>,
  ): LifeDocAccessRole | null {
    if (userId === ownerId) return LifeDocAccessRole.OWNER;

    const h = this.crypto.hmacUserId(userId);
    const match = grants.find((g) => g.granteeHash === h);
    return match?.role ?? null;
  }

  private ensureCanRead(viewerRole: LifeDocAccessRole | null) {
    if (!viewerRole) {
      throw new ForbiddenException("Not authorized to access this document");
    }
  }

  private ensureCanManage(viewerRole: LifeDocAccessRole | null) {
    if (!viewerRole || viewerRole === LifeDocAccessRole.VIEWER) {
      throw new ForbiddenException("Not authorized to manage this document");
    }
  }

  private ensureCanDelete(viewerRole: LifeDocAccessRole | null) {
    if (viewerRole !== LifeDocAccessRole.OWNER) {
      throw new ForbiddenException("Only owner can delete this document");
    }
  }

  private buildResponse(params: {
    doc: any;
    vaultMediaId: string;
    status: LifeDocStatus;
    viewerRole: LifeDocAccessRole;
  }): LifeDocResponse {
    const { doc, vaultMediaId, status, viewerRole } = params;

    const effectiveRenewalState = this.computeEffectiveRenewalState({
      doc,
      nowUtc: new Date(),
      timezone: doc.owner?.timezone ?? "Asia/Kolkata",
    });

    return {
      id: doc.id,
      ownerId: doc.ownerId,
      ownerDisplayName: doc.owner?.displayName ?? null,
      category: doc.category,
      subcategory: doc.subcategory,
      customSubcategory: doc.customSubcategory ?? null,
      title: doc.title,
      issuingAuthority: doc.issuingAuthority,
      issueDate: doc.issueDate ? toUserDateIso(doc.issueDate, doc.owner.timezone) : null,
      expiryDate: doc.expiryDate ? toUserDateIso(doc.expiryDate, doc.owner.timezone) : null,
      renewalRequired: doc.renewalRequired,
      renewalState: effectiveRenewalState as any,
      reminderSetting: doc.reminderSetting,
      reminderCustomDays:
        Array.isArray(doc.reminderCustomDays) && doc.reminderCustomDays.length > 0
          ? doc.reminderCustomDays
          : null,
      quietHours:
        doc.quietHoursStart || doc.quietHoursEnd
          ? { start: doc.quietHoursStart ?? null, end: doc.quietHoursEnd ?? null }
          : null,
      notifySharedMembers: !!doc.notifySharedMembers,
      lastRemindedAt: doc.lastRemindedAt ? new Date(doc.lastRemindedAt).toISOString() : null,
      visibility: doc.visibility,
      status: status as any,
      versionGroupId: doc.versionGroupId,
      fileHash: doc.fileHash,
      uploadTimestamp: new Date(doc.uploadTimestamp).toISOString(),
      createdAt: new Date(doc.createdAt).toISOString(),
      updatedAt: new Date(doc.updatedAt).toISOString(),
      vaultMediaId,
      viewerRole: viewerRole as any,

      maskedMode: !!doc.maskedMode,
      maskedHideExpiry:
        doc.maskedHideExpiry === undefined ? true : !!doc.maskedHideExpiry,
      aliasTitle: doc.aliasTitle ?? null,
    };
  }

  private computeEffectiveRenewalState(params: {
    doc: any;
    nowUtc: Date;
    timezone: string;
  }): LifeDocRenewalState {
    const { doc, nowUtc, timezone } = params;

    if (!doc.renewalRequired) return LifeDocRenewalState.NOT_REQUIRED;

    const stored =
      (doc.renewalState as LifeDocRenewalState | undefined) ??
      LifeDocRenewalState.NOT_REQUIRED;

    if (
      stored === LifeDocRenewalState.IN_PROGRESS ||
      stored === LifeDocRenewalState.COMPLETED ||
      stored === LifeDocRenewalState.BLOCKED
    ) {
      return stored;
    }

    if (doc.expiryDate) {
      const daysUntil = computeDaysUntilExpiry(nowUtc, doc.expiryDate, timezone);
      if (daysUntil >= 0 && daysUntil <= 90) return LifeDocRenewalState.UPCOMING;
    }

    return LifeDocRenewalState.NOT_REQUIRED;
  }

  private safeOpenAcl(sealed: any): LifeDocAclPayload {
    try {
      return this.crypto.openJson<LifeDocAclPayload>(sealed);
    } catch {
      return defaultAclPayload();
    }
  }

  private normalizeCustomSubcategoryOrThrow(params: {
    subcategory: LifeDocSubcategory;
    customSubcategory?: string | null;
  }): string | null {
    const { subcategory } = params;

    if (subcategory !== LifeDocSubcategory.CUSTOM) return null;

    const value = String(params.customSubcategory ?? "").trim();
    if (!value) {
      throw new BadRequestException(
        "customSubcategory is required when subcategory is CUSTOM",
      );
    }

    // Keep it short for UI + reminders payloads.
    if (value.length > 80) {
      throw new BadRequestException("customSubcategory is too long");
    }

    return value;
  }

  private async verifyVaultIntegrityOrThrow(doc: any, vaultMediaId: string) {
    const media = await this.prisma.media.findUnique({
      where: { id: vaultMediaId },
      select: { id: true, userId: true, type: true, sha256Ciphertext: true, uploadedAt: true, createdAt: true },
    });

    if (!media) {
      throw new NotFoundException("Vault reference missing");
    }

    // Fail closed if referenced media moved across user boundary.
    if (media.userId !== doc.ownerId) {
      throw new ForbiddenException("Vault reference invalid");
    }

    const hash = media.sha256Ciphertext
      ? Buffer.from(media.sha256Ciphertext).toString("base64")
      : null;

    if (!hash || hash !== doc.fileHash) {
      throw new ForbiddenException("Vault integrity verification failed");
    }

    if (media.type !== MediaType.DOCUMENT && media.type !== MediaType.PHOTO) {
      throw new BadRequestException(
        "Referenced vault object must be a document or image",
      );
    }

    return {
      uploadedAt: media.uploadedAt ?? media.createdAt,
    };
  }

  async create(userId: string, dto: CreateLifeDocDto): Promise<LifeDocResponse> {
    const owner = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, timezone: true, displayName: true },
    });
    if (!owner) throw new NotFoundException("User not found");

    const media = await this.prisma.media.findUnique({
      where: { id: dto.mediaId },
      select: {
        id: true,
        userId: true,
        type: true,
        sha256Ciphertext: true,
        uploadedAt: true,
        createdAt: true,
      },
    });

    if (!media || media.userId !== userId) {
      throw new ForbiddenException("Not authorized to use this vault object");
    }
    if (media.type !== MediaType.DOCUMENT && media.type !== MediaType.PHOTO) {
      throw new BadRequestException(
        "Life Docs only supports Vault documents or images",
      );
    }

    const fileHash = media.sha256Ciphertext
      ? Buffer.from(media.sha256Ciphertext).toString("base64")
      : null;

    if (!fileHash) {
      throw new BadRequestException("Vault object missing integrity hash");
    }

    const uploadTimestamp = media.uploadedAt ?? media.createdAt;

    const visibility = dto.visibility ?? LifeDocVisibility.PRIVATE;
    let acl = this.normalizeAclInput(dto.accessRoles as any);

    if (visibility === LifeDocVisibility.PRIVATE) {
      acl = defaultAclPayload();
    }

    const sealedVaultObjectId = this.crypto.sealJson<VaultPointerPayload>({
      mediaId: dto.mediaId,
    });

    const sealedAcl = this.crypto.sealJson<LifeDocAclPayload>(acl);

    const now = new Date();

    const customSubcategory = this.normalizeCustomSubcategoryOrThrow({
      subcategory: dto.subcategory as any,
      customSubcategory: dto.customSubcategory ?? null,
    });

    const created = await this.prisma.$transaction(async (tx) => {
      const doc = await tx.lifeDoc.create({
        data: {
          vaultObjectId: sealedVaultObjectId as any,
          ownerId: userId,
          category: dto.category as any,
          subcategory: dto.subcategory as any,
          customSubcategory,
          title: dto.title,
          issuingAuthority: dto.issuingAuthority ?? null,
          issueDate: dto.issueDate
            ? parseIsoDateToUtcStart(dto.issueDate, owner.timezone)
            : null,
          expiryDate: dto.expiryDate
            ? parseIsoDateToUtcStart(dto.expiryDate, owner.timezone)
            : null,
          renewalRequired: dto.renewalRequired ?? false,
          renewalState: LifeDocRenewalState.NOT_REQUIRED,
          reminderSetting:
            (dto.reminderSetting as any) ?? LifeDocReminderSetting.EXPIRY_DEFAULT,
          notifySharedMembers: acl.notifySharedMembers,
          visibility,
          accessRoles: sealedAcl as any,
          status: LifeDocStatus.ACTIVE,
          versionGroupId: randomUUID(),
          fileHash,
          uploadTimestamp,
          createdAt: now,
          updatedAt: now,
        },
        include: { accessGrants: true, owner: { select: { timezone: true, displayName: true } } },
      });

      await this.syncAccessGrants(tx, doc.id, acl);

      await tx.auditEvent.create({
        data: {
          userId,
          eventType: "LIFE_DOC_CREATED",
          entityType: "LIFE_DOC",
          entityId: doc.id,
          meta: { category: doc.category, subcategory: doc.subcategory },
        },
      });

      return doc;
    });

    const viewerRole = LifeDocAccessRole.OWNER;

    const pointer = this.crypto.openJson<VaultPointerPayload>(created.vaultObjectId);
    await this.verifyVaultIntegrityOrThrow(created, pointer.mediaId);

    const status = this.computeEffectiveStatus({
      doc: created,
      nowUtc: now,
      timezone: created.owner.timezone,
      latestInVersionGroup: true,
    });

    return this.buildResponse({
      doc: created,
      vaultMediaId: pointer.mediaId,
      status,
      viewerRole,
    });
  }

  private computeEffectiveStatus(params: {
    doc: any;
    nowUtc: Date;
    timezone: string;
    latestInVersionGroup: boolean;
  }): LifeDocStatus {
    const { doc, nowUtc, timezone, latestInVersionGroup } = params;

    if (doc.status === LifeDocStatus.ARCHIVED) return LifeDocStatus.ARCHIVED;
    if (!latestInVersionGroup) return LifeDocStatus.REPLACED;

    return computeAutoStatus(nowUtc, doc.expiryDate, timezone);
  }

  async list(userId: string): Promise<LifeDocListResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException("User not found");

    const viewerHash = this.crypto.hmacUserId(userId);

    const docs = await this.prisma.lifeDoc.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { accessGrants: { some: { granteeHash: viewerHash } } },
        ],
      },
      include: {
        accessGrants: true,
        owner: { select: { timezone: true, displayName: true } },
      },
      orderBy: [{ category: "asc" }, { createdAt: "desc" }],
    });

    const now = new Date();

    // Determine latest doc per version group (by uploadTimestamp then createdAt).
    const bestByGroup = new Map<string, { id: string; uploadTimestamp: Date; createdAt: Date }>();
    for (const d of docs) {
      const cur = bestByGroup.get(d.versionGroupId);
      if (!cur) {
        bestByGroup.set(d.versionGroupId, {
          id: d.id,
          uploadTimestamp: d.uploadTimestamp,
          createdAt: d.createdAt,
        });
        continue;
      }
      const better =
        d.uploadTimestamp > cur.uploadTimestamp ||
        (d.uploadTimestamp.getTime() === cur.uploadTimestamp.getTime() &&
          d.createdAt > cur.createdAt);
      if (better) {
        bestByGroup.set(d.versionGroupId, {
          id: d.id,
          uploadTimestamp: d.uploadTimestamp,
          createdAt: d.createdAt,
        });
      }
    }

    const items: LifeDocResponse[] = [];
    for (const doc of docs) {
      let pointer: VaultPointerPayload;
      try {
        pointer = this.crypto.openJson<VaultPointerPayload>(doc.vaultObjectId);
      } catch {
        // Fail closed: inaccessible if pointer cannot be opened.
        continue;
      }

      const viewerRole = this.getViewerRoleOrNull(userId, doc.ownerId, doc.accessGrants);
      if (!viewerRole) continue;

      // Fail closed: if vault reference missing or hash mismatch, hide.
      try {
        await this.verifyVaultIntegrityOrThrow(doc, pointer.mediaId);
      } catch {
        continue;
      }

      const latestInGroup = bestByGroup.get(doc.versionGroupId)?.id === doc.id;
      const status = this.computeEffectiveStatus({
        doc,
        nowUtc: now,
        timezone: doc.owner.timezone,
        latestInVersionGroup: latestInGroup,
      });

      items.push(
        this.buildResponse({
          doc,
          vaultMediaId: pointer.mediaId,
          status,
          viewerRole,
        }),
      );
    }

    return { items };
  }

  async getById(userId: string, id: string): Promise<LifeDocResponse> {
    const doc = await this.prisma.lifeDoc.findUnique({
      where: { id },
      include: {
        accessGrants: true,
        owner: { select: { timezone: true, displayName: true } },
      },
    });

    if (!doc) throw new NotFoundException("Document not found");

    const viewerRole = this.getViewerRoleOrNull(userId, doc.ownerId, doc.accessGrants);
    this.ensureCanRead(viewerRole);

    let pointer: VaultPointerPayload;
    try {
      pointer = this.crypto.openJson<VaultPointerPayload>(doc.vaultObjectId);
    } catch {
      throw new ForbiddenException("Vault reference invalid");
    }

    await this.verifyVaultIntegrityOrThrow(doc, pointer.mediaId);

    // Audit access event visible to owner.
    await this.prisma.auditEvent.create({
      data: {
        userId: doc.ownerId,
        eventType: "LIFE_DOC_ACCESSED",
        entityType: "LIFE_DOC",
        entityId: doc.id,
        meta: { byUserId: userId },
      },
    });

    // Determine if replaced.
    const latest = await this.prisma.lifeDoc.findFirst({
      where: { versionGroupId: doc.versionGroupId },
      orderBy: [{ uploadTimestamp: "desc" }, { createdAt: "desc" }],
      select: { id: true },
    });

    const status = this.computeEffectiveStatus({
      doc,
      nowUtc: new Date(),
      timezone: doc.owner.timezone,
      latestInVersionGroup: latest?.id === doc.id,
    });

    return this.buildResponse({
      doc,
      vaultMediaId: pointer.mediaId,
      status,
      viewerRole: viewerRole!,
    });
  }

  async update(userId: string, id: string, dto: UpdateLifeDocDto): Promise<LifeDocResponse> {
    const doc = await this.prisma.lifeDoc.findUnique({
      where: { id },
      include: { accessGrants: true, owner: { select: { timezone: true, displayName: true } } },
    });
    if (!doc) throw new NotFoundException("Document not found");

    const viewerRole = this.getViewerRoleOrNull(userId, doc.ownerId, doc.accessGrants);
    this.ensureCanManage(viewerRole);

    const timezone = doc.owner.timezone;

    const visibility = (dto.visibility as any) ?? doc.visibility;

    let aclPayload: LifeDocAclPayload | null = null;
    if (dto.accessRoles) {
      aclPayload = this.normalizeAclInput(dto.accessRoles as any);
      if (visibility === LifeDocVisibility.PRIVATE) {
        aclPayload = defaultAclPayload();
      }
    }

    const reminderSettingChanged =
      dto.reminderSetting !== undefined && dto.reminderSetting !== doc.reminderSetting;
    const sharedChanged = dto.accessRoles !== undefined;

    const updateData: Prisma.LifeDocUpdateInput = {
      category: (dto.category as any) ?? undefined,
      subcategory: (dto.subcategory as any) ?? undefined,
      title: dto.title ?? undefined,
      issuingAuthority: dto.issuingAuthority === undefined ? undefined : dto.issuingAuthority,
      issueDate: dto.issueDate ? parseIsoDateToUtcStart(dto.issueDate, timezone) : undefined,
      expiryDate: dto.expiryDate ? parseIsoDateToUtcStart(dto.expiryDate, timezone) : undefined,
      renewalRequired: dto.renewalRequired ?? undefined,
      reminderSetting: (dto.reminderSetting as any) ?? undefined,
      visibility: visibility as any,
      accessRoles: aclPayload ? (this.crypto.sealJson(aclPayload) as any) : undefined,
      notifySharedMembers: aclPayload ? aclPayload.notifySharedMembers : undefined,
    };

    if (dto.renewalRequired === false) {
      updateData.renewalState = LifeDocRenewalState.NOT_REQUIRED as any;
    }

    // Custom subcategory rules
    const nextSubcategory: LifeDocSubcategory =
      (dto.subcategory as any) ?? (doc.subcategory as any);

    if (dto.subcategory !== undefined) {
      // Subcategory explicitly changed.
      if (nextSubcategory === LifeDocSubcategory.CUSTOM) {
        updateData.customSubcategory = this.normalizeCustomSubcategoryOrThrow({
          subcategory: nextSubcategory,
          customSubcategory: dto.customSubcategory ?? (doc.customSubcategory ?? null),
        });
      } else {
        // Switching away from CUSTOM clears any stale custom label.
        updateData.customSubcategory = null;
      }
    } else if (dto.customSubcategory !== undefined) {
      // Only update customSubcategory when doc (or next) is CUSTOM.
      if (nextSubcategory !== LifeDocSubcategory.CUSTOM) {
        throw new BadRequestException(
          "customSubcategory can only be set when subcategory is CUSTOM",
        );
      }

      updateData.customSubcategory = this.normalizeCustomSubcategoryOrThrow({
        subcategory: nextSubcategory,
        customSubcategory: dto.customSubcategory,
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.lifeDoc.update({
        where: { id },
        data: updateData,
        include: { accessGrants: true, owner: { select: { timezone: true, displayName: true } } },
      });

      if (aclPayload) {
        await this.syncAccessGrants(tx, saved.id, aclPayload);
      }

      await tx.auditEvent.create({
        data: {
          userId: saved.ownerId,
          eventType: "LIFE_DOC_UPDATED",
          entityType: "LIFE_DOC",
          entityId: saved.id,
          meta: { byUserId: userId },
        },
      });

      if (sharedChanged) {
        await tx.auditEvent.create({
          data: {
            userId: saved.ownerId,
            eventType: "LIFE_DOC_SHARED",
            entityType: "LIFE_DOC",
            entityId: saved.id,
            meta: { byUserId: userId },
          },
        });
      }

      if (reminderSettingChanged) {
        await tx.auditEvent.create({
          data: {
            userId: saved.ownerId,
            eventType: "LIFE_DOC_REMINDER_CHANGED",
            entityType: "LIFE_DOC",
            entityId: saved.id,
            meta: { byUserId: userId },
          },
        });
      }

      return saved;
    });

    const pointer = this.crypto.openJson<VaultPointerPayload>(updated.vaultObjectId);
    await this.verifyVaultIntegrityOrThrow(updated, pointer.mediaId);

    const latest = await this.prisma.lifeDoc.findFirst({
      where: { versionGroupId: updated.versionGroupId },
      orderBy: [{ uploadTimestamp: "desc" }, { createdAt: "desc" }],
      select: { id: true },
    });

    const status = this.computeEffectiveStatus({
      doc: updated,
      nowUtc: new Date(),
      timezone: updated.owner.timezone,
      latestInVersionGroup: latest?.id === updated.id,
    });

    return this.buildResponse({
      doc: updated,
      vaultMediaId: pointer.mediaId,
      status,
      viewerRole: viewerRole!,
    });
  }

  async archive(userId: string, id: string): Promise<{ success: true }> {
    const doc = await this.prisma.lifeDoc.findUnique({
      where: { id },
      include: { accessGrants: true },
    });
    if (!doc) throw new NotFoundException("Document not found");

    const viewerRole = this.getViewerRoleOrNull(userId, doc.ownerId, doc.accessGrants);
    this.ensureCanManage(viewerRole);

    await this.prisma.lifeDoc.update({
      where: { id },
      data: { status: LifeDocStatus.ARCHIVED },
    });

    await this.prisma.auditEvent.create({
      data: {
        userId: doc.ownerId,
        eventType: "LIFE_DOC_ARCHIVED",
        entityType: "LIFE_DOC",
        entityId: doc.id,
        meta: { byUserId: userId },
      },
    });

    return { success: true };
  }

  async replace(userId: string, id: string, dto: ReplaceLifeDocDto): Promise<LifeDocResponse> {
    const existing = await this.prisma.lifeDoc.findUnique({
      where: { id },
      include: { accessGrants: true, owner: { select: { timezone: true, displayName: true } } },
    });
    if (!existing) throw new NotFoundException("Document not found");

    const viewerRole = this.getViewerRoleOrNull(userId, existing.ownerId, existing.accessGrants);
    this.ensureCanManage(viewerRole);

    const owner = await this.prisma.user.findUnique({
      where: { id: existing.ownerId },
      select: { id: true, timezone: true, displayName: true },
    });
    if (!owner) throw new NotFoundException("User not found");

    const media = await this.prisma.media.findUnique({
      where: { id: dto.mediaId },
      select: { id: true, userId: true, type: true, sha256Ciphertext: true, uploadedAt: true, createdAt: true },
    });

    if (!media || media.userId !== existing.ownerId) {
      throw new ForbiddenException("Not authorized to use this vault object");
    }
    if (media.type !== MediaType.DOCUMENT && media.type !== MediaType.PHOTO) {
      throw new BadRequestException(
        "Life Docs only supports Vault documents or images",
      );
    }

    const fileHash = media.sha256Ciphertext
      ? Buffer.from(media.sha256Ciphertext).toString("base64")
      : null;
    if (!fileHash) throw new BadRequestException("Vault object missing integrity hash");

    const uploadTimestamp = media.uploadedAt ?? media.createdAt;

    // Preserve ACL by default.
    const acl = (() => {
      try {
        return this.crypto.openJson<LifeDocAclPayload>(existing.accessRoles);
      } catch {
        return defaultAclPayload();
      }
    })();

    const now = new Date();

    const created = await this.prisma.$transaction(async (tx) => {
      const doc = await tx.lifeDoc.create({
        data: {
          vaultObjectId: this.crypto.sealJson<VaultPointerPayload>({ mediaId: dto.mediaId }) as any,
          ownerId: existing.ownerId,
          category: existing.category,
          subcategory: existing.subcategory,
          customSubcategory: existing.customSubcategory,
          title: dto.title ?? existing.title,
          issuingAuthority: dto.issuingAuthority ?? existing.issuingAuthority,
          issueDate: dto.issueDate
            ? parseIsoDateToUtcStart(dto.issueDate, owner.timezone)
            : existing.issueDate,
          expiryDate: dto.expiryDate
            ? parseIsoDateToUtcStart(dto.expiryDate, owner.timezone)
            : existing.expiryDate,
          renewalRequired: existing.renewalRequired,
          renewalState: existing.renewalState,
          reminderSetting: (dto.reminderSetting as any) ?? existing.reminderSetting,
          reminderCustomDays: existing.reminderCustomDays as any,
          quietHoursStart: existing.quietHoursStart,
          quietHoursEnd: existing.quietHoursEnd,
          notifySharedMembers: existing.notifySharedMembers,
          lastRemindedAt: null,
          maskedMode: existing.maskedMode,
          maskedHideExpiry: existing.maskedHideExpiry,
          aliasTitle: existing.aliasTitle,
          visibility: (dto.visibility as any) ?? existing.visibility,
          accessRoles: this.crypto.sealJson<LifeDocAclPayload>(acl) as any,
          status: LifeDocStatus.ACTIVE,
          versionGroupId: existing.versionGroupId,
          fileHash,
          uploadTimestamp,
          createdAt: now,
          updatedAt: now,
        },
        include: { accessGrants: true, owner: { select: { timezone: true, displayName: true } } },
      });

      await this.syncAccessGrants(tx, doc.id, acl);

      await tx.auditEvent.create({
        data: {
          userId: existing.ownerId,
          eventType: "LIFE_DOC_REPLACED",
          entityType: "LIFE_DOC",
          entityId: existing.id,
          meta: { replacedById: doc.id, byUserId: userId },
        },
      });

      return doc;
    });

    const pointer = this.crypto.openJson<VaultPointerPayload>(created.vaultObjectId);
    await this.verifyVaultIntegrityOrThrow(created, pointer.mediaId);

    const status = this.computeEffectiveStatus({
      doc: created,
      nowUtc: now,
      timezone: created.owner.timezone,
      latestInVersionGroup: true,
    });

    return this.buildResponse({
      doc: created,
      vaultMediaId: pointer.mediaId,
      status,
      viewerRole: viewerRole!,
    });
  }

  async delete(userId: string, id: string): Promise<{ success: true }> {
    const doc = await this.prisma.lifeDoc.findUnique({
      where: { id },
      include: { accessGrants: true },
    });
    if (!doc) throw new NotFoundException("Document not found");

    const viewerRole = this.getViewerRoleOrNull(userId, doc.ownerId, doc.accessGrants);
    this.ensureCanDelete(viewerRole);

    await this.prisma.$transaction(async (tx) => {
      await tx.lifeDocAccessGrant.deleteMany({ where: { lifeDocId: doc.id } });
      await tx.lifeDocReminderSent.deleteMany({ where: { lifeDocId: doc.id } });
      await tx.lifeDocReminderEvent.deleteMany({ where: { lifeDocId: doc.id } });
      await tx.lifeDoc.delete({ where: { id: doc.id } });

      await tx.auditEvent.create({
        data: {
          userId: doc.ownerId,
          eventType: "LIFE_DOC_DELETED",
          entityType: "LIFE_DOC",
          entityId: doc.id,
          meta: { byUserId: userId },
        },
      });
    });

    return { success: true };
  }

  async updateReminders(
    userId: string,
    id: string,
    dto: UpdateLifeDocRemindersDto,
  ): Promise<LifeDocResponse> {
    const doc = await this.prisma.lifeDoc.findUnique({
      where: { id },
      include: { accessGrants: true, owner: { select: { timezone: true, displayName: true } } },
    });
    if (!doc) throw new NotFoundException("Document not found");

    const viewerRole = this.getViewerRoleOrNull(userId, doc.ownerId, doc.accessGrants);
    this.ensureCanManage(viewerRole);

    if (dto.channels) {
      if (!dto.channels.inApp) {
        throw new BadRequestException("In-app channel must be enabled");
      }
      if (dto.channels.email || dto.channels.push) {
        throw new BadRequestException("Email/push channels are not supported in this build");
      }
    }

    const acl = this.safeOpenAcl(doc.accessRoles);
    const notifySharedMembers =
      typeof dto.notifySharedMembers === "boolean"
        ? dto.notifySharedMembers
        : (doc.notifySharedMembers ?? acl.notifySharedMembers);

    const aclChanged = typeof dto.notifySharedMembers === "boolean";
    if (aclChanged) {
      acl.notifySharedMembers = notifySharedMembers;
    }

    const saved = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.lifeDoc.update({
        where: { id: doc.id },
        data: {
          reminderSetting: (dto.reminderSetting as any) ?? undefined,
          reminderCustomDays:
            dto.reminderCustomDays === undefined
              ? undefined
              : ((dto.reminderCustomDays ?? []) as any),
          quietHoursStart:
            dto.quietHours?.start === undefined ? undefined : (dto.quietHours?.start as any),
          quietHoursEnd:
            dto.quietHours?.end === undefined ? undefined : (dto.quietHours?.end as any),
          notifySharedMembers,
          accessRoles: aclChanged ? (this.crypto.sealJson<LifeDocAclPayload>(acl) as any) : undefined,
        },
        include: { accessGrants: true, owner: { select: { timezone: true, displayName: true } } },
      });

      await tx.auditEvent.create({
        data: {
          userId: doc.ownerId,
          eventType: "LIFE_DOC_REMINDER_CHANGED",
          entityType: "LIFE_DOC",
          entityId: doc.id,
          meta: { byUserId: userId },
        },
      });

      return updated;
    });

    let pointer: VaultPointerPayload;
    try {
      pointer = this.crypto.openJson<VaultPointerPayload>(saved.vaultObjectId);
    } catch {
      throw new ForbiddenException("Vault reference invalid");
    }
    await this.verifyVaultIntegrityOrThrow(saved, pointer.mediaId);

    const latest = await this.prisma.lifeDoc.findFirst({
      where: { versionGroupId: saved.versionGroupId },
      orderBy: [{ uploadTimestamp: "desc" }, { createdAt: "desc" }],
      select: { id: true },
    });

    const status = this.computeEffectiveStatus({
      doc: saved,
      nowUtc: new Date(),
      timezone: saved.owner.timezone,
      latestInVersionGroup: latest?.id === saved.id,
    });

    return this.buildResponse({
      doc: saved,
      vaultMediaId: pointer.mediaId,
      status,
      viewerRole: viewerRole!,
    });
  }

  async setRenewalState(
    userId: string,
    id: string,
    dto: SetLifeDocRenewalStateDto,
  ): Promise<LifeDocResponse> {
    const doc = await this.prisma.lifeDoc.findUnique({
      where: { id },
      include: { accessGrants: true, owner: { select: { timezone: true, displayName: true } } },
    });
    if (!doc) throw new NotFoundException("Document not found");

    const viewerRole = this.getViewerRoleOrNull(userId, doc.ownerId, doc.accessGrants);
    this.ensureCanManage(viewerRole);

    const next = doc.renewalRequired
      ? (dto.state as any)
      : (LifeDocRenewalState.NOT_REQUIRED as any);

    const saved = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.lifeDoc.update({
        where: { id: doc.id },
        data: { renewalState: next },
        include: { accessGrants: true, owner: { select: { timezone: true, displayName: true } } },
      });

      await tx.auditEvent.create({
        data: {
          userId: doc.ownerId,
          eventType: "LIFE_DOC_RENEWAL_STATE_CHANGED",
          entityType: "LIFE_DOC",
          entityId: doc.id,
          meta: { byUserId: userId, state: dto.state },
        },
      });

      return updated;
    });

    let pointer: VaultPointerPayload;
    try {
      pointer = this.crypto.openJson<VaultPointerPayload>(saved.vaultObjectId);
    } catch {
      throw new ForbiddenException("Vault reference invalid");
    }
    await this.verifyVaultIntegrityOrThrow(saved, pointer.mediaId);

    const latest = await this.prisma.lifeDoc.findFirst({
      where: { versionGroupId: saved.versionGroupId },
      orderBy: [{ uploadTimestamp: "desc" }, { createdAt: "desc" }],
      select: { id: true },
    });

    const status = this.computeEffectiveStatus({
      doc: saved,
      nowUtc: new Date(),
      timezone: saved.owner.timezone,
      latestInVersionGroup: latest?.id === saved.id,
    });

    return this.buildResponse({
      doc: saved,
      vaultMediaId: pointer.mediaId,
      status,
      viewerRole: viewerRole!,
    });
  }

  async getRenewalSummary(userId: string): Promise<LifeDocsRenewalSummaryResponse> {
    const list = await this.list(userId);

    const counts: LifeDocsRenewalSummaryResponse = {
      notRequired: 0,
      upcoming: 0,
      inProgress: 0,
      completed: 0,
      blocked: 0,
    };

    for (const d of list.items) {
      if (d.ownerId !== userId) continue;
      const state = d.renewalState ?? SharedLifeDocRenewalState.NOT_REQUIRED;
      if (state === SharedLifeDocRenewalState.NOT_REQUIRED) counts.notRequired += 1;
      else if (state === SharedLifeDocRenewalState.UPCOMING) counts.upcoming += 1;
      else if (state === SharedLifeDocRenewalState.IN_PROGRESS) counts.inProgress += 1;
      else if (state === SharedLifeDocRenewalState.COMPLETED) counts.completed += 1;
      else if (state === SharedLifeDocRenewalState.BLOCKED) counts.blocked += 1;
    }

    return counts;
  }

  async getTimeline(params: {
    userId: string;
    months: number;
    ownerId?: string;
    category?: string;
    status?: string;
  }): Promise<LifeDocsTimelineResponse> {
    const { userId } = params;
    const months = Math.max(1, Math.min(36, Number(params.months || 12)));
    const list = await this.list(userId);

    const now = new Date();
    const horizon = new Date(now);
    horizon.setMonth(horizon.getMonth() + months);

    const filtered = list.items
      .filter((d) => {
        if (params.ownerId && d.ownerId !== params.ownerId) return false;
        if (params.category && String(d.category) !== String(params.category)) return false;
        if (!d.expiryDate) return false;

        const expiryMs = Date.parse(d.expiryDate);
        if (Number.isFinite(expiryMs) && expiryMs > horizon.getTime()) return false;

        if (params.status) {
          const s = String(params.status);
          if (s === "ARCHIVED" && d.status !== "ARCHIVED") return false;
          if (s === "EXPIRED" && d.status !== "EXPIRED") return false;
          if (s === "EXPIRING" && d.status !== "EXPIRING_SOON") return false;
          if (s === "ACTIVE" && d.status !== "ACTIVE") return false;
        }

        return true;
      })
      .sort((a, b) => {
        const ae = a.expiryDate ? Date.parse(a.expiryDate) : Number.POSITIVE_INFINITY;
        const be = b.expiryDate ? Date.parse(b.expiryDate) : Number.POSITIVE_INFINITY;
        return ae - be;
      });

    const groupsMap = new Map<string, LifeDocResponse[]>();
    for (const d of filtered) {
      const month = String(d.expiryDate).slice(0, 7);
      const arr = groupsMap.get(month) ?? [];
      arr.push(d);
      groupsMap.set(month, arr);
    }

    const groupKeys = Array.from(groupsMap.keys()).sort();
    const groups = groupKeys.map((month) => ({ month, items: groupsMap.get(month)! }));

    return { months, groups };
  }

  async search(params: {
    userId: string;
    q: string;
    ownerId?: string;
    category?: string;
  }): Promise<LifeDocsSearchResponse> {
    const q = String(params.q ?? "").trim().toLowerCase();
    const list = await this.list(params.userId);

    const items = list.items.filter((d) => {
      if (params.ownerId && d.ownerId !== params.ownerId) return false;
      if (params.category && String(d.category) !== String(params.category)) return false;
      if (!q) return true;

      const hay = [
        d.title,
        d.issuingAuthority ?? "",
        String(d.category),
        String(d.subcategory),
        d.customSubcategory ?? "",
        d.ownerDisplayName ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });

    return { items };
  }

  async getFamilyOverview(userId: string): Promise<LifeDocsFamilyOverviewResponse> {
    const viewerHash = this.crypto.hmacUserId(userId);
    const grants = await this.prisma.lifeDocAccessGrant.findMany({
      where: { granteeHash: viewerHash, kind: LifeDocAccessGrantKind.GUARDIAN },
      select: { lifeDocId: true },
    });
    const guardianDocIds = new Set(grants.map((g) => g.lifeDocId));

    const list = await this.list(userId);

    const myExpiringSoon = list.items.filter(
      (d) => d.ownerId === userId && d.status === LifeDocStatus.EXPIRING_SOON,
    ).length;

    const sharedWithMe = list.items.filter((d) => d.ownerId !== userId).length;

    const childrenExpiringSoon = list.items.filter(
      (d) => d.ownerId !== userId && d.status === LifeDocStatus.EXPIRING_SOON && guardianDocIds.has(d.id),
    ).length;

    const needsRenewal = list.items.filter((d) => {
      if (d.ownerId !== userId && d.viewerRole === LifeDocAccessRole.VIEWER) return false;
      return (
        d.renewalState === SharedLifeDocRenewalState.UPCOMING ||
        d.renewalState === SharedLifeDocRenewalState.IN_PROGRESS
      );
    }).length;

    return {
      myExpiringSoon,
      childrenExpiringSoon,
      sharedWithMe,
      needsRenewal,
    };
  }

  async getVersions(userId: string, id: string): Promise<LifeDocVersionsResponse> {
    const base = await this.prisma.lifeDoc.findUnique({
      where: { id },
      include: { accessGrants: true, owner: { select: { timezone: true, displayName: true } } },
    });
    if (!base) throw new NotFoundException("Document not found");

    const viewerRole = this.getViewerRoleOrNull(userId, base.ownerId, base.accessGrants);
    this.ensureCanRead(viewerRole);

    const versions = await this.prisma.lifeDoc.findMany({
      where: { versionGroupId: base.versionGroupId },
      orderBy: [{ uploadTimestamp: "desc" }, { createdAt: "desc" }],
      select: { id: true, uploadTimestamp: true, fileHash: true, status: true },
    });

    const latestId = versions[0]?.id;

    return {
      id: base.id,
      versionGroupId: base.versionGroupId,
      versions: versions.map((v) => ({
        versionId: v.id,
        uploadTimestamp: new Date(v.uploadTimestamp).toISOString(),
        fileHash: v.fileHash,
        status: v.status as any,
        isLatest: v.id === latestId,
      })),
    };
  }

  async restoreVersion(userId: string, id: string, versionId: string): Promise<LifeDocResponse> {
    const base = await this.prisma.lifeDoc.findUnique({
      where: { id },
      include: { accessGrants: true, owner: { select: { timezone: true, displayName: true } } },
    });
    if (!base) throw new NotFoundException("Document not found");

    const viewerRole = this.getViewerRoleOrNull(userId, base.ownerId, base.accessGrants);
    this.ensureCanManage(viewerRole);

    const target = await this.prisma.lifeDoc.findUnique({
      where: { id: versionId },
      include: { owner: { select: { timezone: true, displayName: true } }, accessGrants: true },
    });
    if (!target || target.versionGroupId !== base.versionGroupId) {
      throw new NotFoundException("Version not found");
    }

    const latest = await this.prisma.lifeDoc.findFirst({
      where: { versionGroupId: base.versionGroupId },
      orderBy: [{ uploadTimestamp: "desc" }, { createdAt: "desc" }],
      include: { accessGrants: true, owner: { select: { timezone: true, displayName: true } } },
    });
    if (!latest) throw new NotFoundException("Document not found");

    let pointer: VaultPointerPayload;
    try {
      pointer = this.crypto.openJson<VaultPointerPayload>(target.vaultObjectId);
    } catch {
      throw new ForbiddenException("Vault reference invalid");
    }

    const integrity = await this.verifyVaultIntegrityOrThrow(target, pointer.mediaId);

    const now = new Date();
    const restored = await this.prisma.$transaction(async (tx) => {
      const acl = this.safeOpenAcl(latest.accessRoles);
      const sealedAcl = this.crypto.sealJson<LifeDocAclPayload>(acl);

      const created = await tx.lifeDoc.create({
        data: {
          vaultObjectId: target.vaultObjectId as any,
          ownerId: latest.ownerId,
          category: latest.category,
          subcategory: latest.subcategory,
          customSubcategory: latest.customSubcategory,
          title: latest.title,
          issuingAuthority: latest.issuingAuthority,
          issueDate: latest.issueDate,
          expiryDate: latest.expiryDate,
          renewalRequired: latest.renewalRequired,
          renewalState: latest.renewalState,
          reminderSetting: latest.reminderSetting,
          reminderCustomDays: latest.reminderCustomDays as any,
          quietHoursStart: latest.quietHoursStart,
          quietHoursEnd: latest.quietHoursEnd,
          notifySharedMembers: latest.notifySharedMembers,
          maskedMode: latest.maskedMode,
          maskedHideExpiry: latest.maskedHideExpiry,
          aliasTitle: latest.aliasTitle,
          visibility: latest.visibility,
          accessRoles: sealedAcl as any,
          status: LifeDocStatus.ACTIVE,
          versionGroupId: latest.versionGroupId,
          fileHash: target.fileHash,
          uploadTimestamp: integrity.uploadedAt,
          createdAt: now,
          updatedAt: now,
        },
        include: { accessGrants: true, owner: { select: { timezone: true, displayName: true } } },
      });

      await this.syncAccessGrants(tx, created.id, acl);

      await tx.auditEvent.create({
        data: {
          userId: latest.ownerId,
          eventType: "LIFE_DOC_VERSION_RESTORED",
          entityType: "LIFE_DOC",
          entityId: created.id,
          meta: { byUserId: userId, restoredFromId: target.id },
        },
      });

      return created;
    });

    const status = this.computeEffectiveStatus({
      doc: restored,
      nowUtc: now,
      timezone: restored.owner.timezone,
      latestInVersionGroup: true,
    });

    return this.buildResponse({
      doc: restored,
      vaultMediaId: pointer.mediaId,
      status,
      viewerRole: viewerRole!,
    });
  }

  async updateMaskedPrivacy(
    userId: string,
    id: string,
    dto: UpdateLifeDocMaskedPrivacyDto,
  ): Promise<LifeDocResponse> {
    const doc = await this.prisma.lifeDoc.findUnique({
      where: { id },
      include: { accessGrants: true, owner: { select: { timezone: true, displayName: true } } },
    });
    if (!doc) throw new NotFoundException("Document not found");

    const viewerRole = this.getViewerRoleOrNull(userId, doc.ownerId, doc.accessGrants);
    this.ensureCanManage(viewerRole);

    const saved = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.lifeDoc.update({
        where: { id: doc.id },
        data: {
          maskedMode: dto.maskedMode,
          maskedHideExpiry: dto.maskedHideExpiry ?? undefined,
          aliasTitle: dto.aliasTitle === undefined ? undefined : (dto.aliasTitle as any),
        },
        include: { accessGrants: true, owner: { select: { timezone: true, displayName: true } } },
      });

      await tx.auditEvent.create({
        data: {
          userId: doc.ownerId,
          eventType: dto.maskedMode
            ? "LIFE_DOC_MASKED_MODE_ENABLED"
            : "LIFE_DOC_MASKED_MODE_DISABLED",
          entityType: "LIFE_DOC",
          entityId: doc.id,
          meta: { byUserId: userId },
        },
      });

      return updated;
    });

    let pointer: VaultPointerPayload;
    try {
      pointer = this.crypto.openJson<VaultPointerPayload>(saved.vaultObjectId);
    } catch {
      throw new ForbiddenException("Vault reference invalid");
    }
    await this.verifyVaultIntegrityOrThrow(saved, pointer.mediaId);

    const latest = await this.prisma.lifeDoc.findFirst({
      where: { versionGroupId: saved.versionGroupId },
      orderBy: [{ uploadTimestamp: "desc" }, { createdAt: "desc" }],
      select: { id: true },
    });

    const status = this.computeEffectiveStatus({
      doc: saved,
      nowUtc: new Date(),
      timezone: saved.owner.timezone,
      latestInVersionGroup: latest?.id === saved.id,
    });

    return this.buildResponse({
      doc: saved,
      vaultMediaId: pointer.mediaId,
      status,
      viewerRole: viewerRole!,
    });
  }

  async testReminders(userId: string, id: string): Promise<{ success: true }> {
    if (process.env.NODE_ENV === "production") {
      throw new ForbiddenException("Not available");
    }

    const allowList = String(process.env.DEV_ADMIN_USER_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (allowList.length > 0 && !allowList.includes(userId)) {
      throw new ForbiddenException("Not authorized");
    }

    const doc = await this.prisma.lifeDoc.findUnique({
      where: { id },
      include: { accessGrants: true, owner: { select: { timezone: true, displayName: true } } },
    });
    if (!doc) throw new NotFoundException("Document not found");

    const viewerRole = this.getViewerRoleOrNull(userId, doc.ownerId, doc.accessGrants);
    this.ensureCanManage(viewerRole);

    await this.prisma.notificationEvent.create({
      data: {
        userId,
        type: "LIFE_DOC_REMINDER_TEST",
        payload: { lifeDocId: doc.id, disclaimer: "Dev-only reminder test" },
      },
      select: { id: true },
    });

    return { success: true };
  }
}
