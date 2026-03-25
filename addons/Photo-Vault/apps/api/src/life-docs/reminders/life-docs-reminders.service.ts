import { Injectable, Logger } from "@nestjs/common";
import {
  LifeDocReminderKind,
  LifeDocReminderSetting,
  LifeDocStatus,
} from "@prisma/client";
import { DateTime } from "luxon";
import { PrismaService } from "../../prisma/prisma.service";
import { LifeDocsCryptoService } from "../life-docs.crypto.service";
import { computeDaysUntilExpiry } from "../life-docs.status";
import { defaultAclPayload, LifeDocAclPayload } from "../life-docs.acl";
import { MailService } from "../../mail/mail.service";
import { ConfigService } from "../../config/config.service";

type VaultPointerPayload = { mediaId: string };

type ReminderToSend = {
  lifeDocId: string;
  ownerId: string;
  ownerTimezone: string;
  recipients: string[];
  kind: LifeDocReminderKind;
  daysBeforeExpiry?: number | null;
  scheduledFor: string; // YYYY-MM-DD in owner's timezone
  expiryDateIso: string;
  title: string;
  category: string;
  subcategory: string;
  maskedMode: boolean;
  maskedHideExpiry: boolean;
  aliasTitle: string | null;
};

const DISCLAIMER = "Reminder assistance only. You remain responsible for renewals.";

@Injectable()
export class LifeDocsRemindersService {
  private readonly logger = new Logger(LifeDocsRemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: LifeDocsCryptoService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async scanAndEmitDueReminders(): Promise<{ scanned: number; emitted: number }> {
    const now = new Date();

    // Pull candidates only: not archived, has expiry date, reminders not OFF.
    const candidates = await this.prisma.lifeDoc.findMany({
      where: {
        expiryDate: { not: null },
        reminderSetting: { not: LifeDocReminderSetting.OFF },
        status: { not: LifeDocStatus.ARCHIVED },
      },
      select: {
        id: true,
        ownerId: true,
        title: true,
        category: true,
        subcategory: true,
        customSubcategory: true,
        expiryDate: true,
        reminderSetting: true,
        reminderCustomDays: true,
        quietHoursStart: true,
        quietHoursEnd: true,
        maskedMode: true,
        maskedHideExpiry: true,
        aliasTitle: true,
        visibility: true,
        accessRoles: true,
        vaultObjectId: true,
        fileHash: true,
      },
    });

    const toSend: ReminderToSend[] = [];

    for (const doc of candidates) {
      const owner = await this.prisma.user.findUnique({
        where: { id: doc.ownerId },
        select: { id: true, timezone: true },
      });
      if (!owner) continue;

      // Fail closed if pointer invalid.
      let pointer: VaultPointerPayload;
      try {
        pointer = this.crypto.openJson<VaultPointerPayload>(doc.vaultObjectId);
      } catch {
        continue;
      }

      // Fail closed if vault reference missing or integrity hash mismatch.
      const media = await this.prisma.media.findUnique({
        where: { id: pointer.mediaId },
        select: { id: true, userId: true, sha256Ciphertext: true },
      });
      if (!media || media.userId !== doc.ownerId) continue;
      const hash = media.sha256Ciphertext
        ? Buffer.from(media.sha256Ciphertext).toString("base64")
        : null;
      if (!hash || hash !== doc.fileHash) continue;

      const expiryDateUtc = doc.expiryDate;
      if (!expiryDateUtc) continue;

      const daysUntil = computeDaysUntilExpiry(now, expiryDateUtc, owner.timezone);

      const nowLocal = DateTime.fromJSDate(now, { zone: owner.timezone });
      const scheduledFor = nowLocal.toISODate();
      if (!scheduledFor) continue;

      const expiryLocal = DateTime.fromJSDate(expiryDateUtc, {
        zone: owner.timezone,
      });
      const expiryDateIso = expiryLocal.toISODate();
      if (!expiryDateIso) continue;

      const customDays = Array.isArray(doc.reminderCustomDays)
        ? doc.reminderCustomDays.filter((d) => Number.isFinite(d))
        : null;

      const kinds: Array<{ kind: LifeDocReminderKind; daysBeforeExpiry?: number | null }> = [];

      if (customDays && customDays.length > 0) {
        for (const d of customDays) {
          if (daysUntil !== d) continue;
          if (d === 90) kinds.push({ kind: LifeDocReminderKind.D90 });
          else if (d === 30) kinds.push({ kind: LifeDocReminderKind.D30 });
          else if (d === 7) kinds.push({ kind: LifeDocReminderKind.D7 });
          else if (d === 0) kinds.push({ kind: LifeDocReminderKind.ON_EXPIRY });
          else kinds.push({ kind: LifeDocReminderKind.CUSTOM, daysBeforeExpiry: d });
        }
      } else {
        if (daysUntil === 90) kinds.push({ kind: LifeDocReminderKind.D90 });
        if (daysUntil === 30) kinds.push({ kind: LifeDocReminderKind.D30 });
        if (daysUntil === 7) kinds.push({ kind: LifeDocReminderKind.D7 });
        if (daysUntil === 0) kinds.push({ kind: LifeDocReminderKind.ON_EXPIRY });
      }

      if (
        doc.reminderSetting === LifeDocReminderSetting.EXPIRY_DEFAULT_AND_MONTHLY_POST &&
        daysUntil < 0
      ) {
        // Monthly post-expiry: same day-of-month as expiry (in owner's timezone).
        const todayParts = scheduledFor.split("-");
        const expiryParts = expiryDateIso.split("-");
        if (todayParts[2] === expiryParts[2]) {
          kinds.push({ kind: LifeDocReminderKind.POST_EXPIRY_MONTHLY });
        }
      }

      if (kinds.length === 0) continue;

      const acl = this.safeOpenAcl(doc.accessRoles);
      const recipients = this.computeRecipients(doc.ownerId, acl);

      for (const k of kinds) {
        const effectiveSubcategory =
          doc.subcategory === "CUSTOM"
            ? String(doc.customSubcategory ?? "Custom")
            : String(doc.subcategory);

        toSend.push({
          lifeDocId: doc.id,
          ownerId: doc.ownerId,
          ownerTimezone: owner.timezone,
          recipients,
          kind: k.kind,
          daysBeforeExpiry: k.daysBeforeExpiry ?? null,
          scheduledFor,
          expiryDateIso,
          title: doc.title,
          category: doc.category,
          subcategory: effectiveSubcategory,
          maskedMode: !!doc.maskedMode,
          maskedHideExpiry: !!doc.maskedHideExpiry,
          aliasTitle: doc.aliasTitle ?? null,
        });
      }
    }

    let emitted = 0;

    for (const r of toSend) {
      const doc = await this.prisma.lifeDoc.findUnique({
        where: { id: r.lifeDocId },
        select: {
          id: true,
          ownerId: true,
          quietHoursStart: true,
          quietHoursEnd: true,
          lastRemindedAt: true,
        },
      });
      if (!doc) continue;

      for (const recipientUserId of r.recipients) {
        const nowUtc = DateTime.fromJSDate(now).toUTC();
        const nowLocal = nowUtc.setZone(r.ownerTimezone);

        const dedupeKey = this.buildDedupeKey({
          lifeDocId: r.lifeDocId,
          recipientUserId,
          kind: r.kind,
          scheduledFor: r.scheduledFor,
          daysBeforeExpiry: r.daysBeforeExpiry ?? null,
        });

        const emailDedupeKey = `${dedupeKey}|email`;

        // Backward-compat: if an older reminder was already recorded for standard kinds, skip.
        if (r.kind !== LifeDocReminderKind.CUSTOM) {
          const alreadyV1 = await this.prisma.lifeDocReminderSent.findUnique({
            where: {
              lifeDocId_recipientUserId_kind_scheduledFor: {
                lifeDocId: r.lifeDocId,
                recipientUserId,
                kind: r.kind,
                scheduledFor: r.scheduledFor,
              },
            },
            select: { id: true },
          });
          if (alreadyV1) continue;
        }

        const result = await this.prisma.$transaction(async (tx) => {
          const existing = await tx.lifeDocReminderEvent.findUnique({
            where: { dedupeKey },
            select: { id: true, sentAt: true, scheduledFor: true },
          });
          if (existing?.sentAt) return { action: "skip" as const };

          const { inQuiet, nextAllowedUtc } = this.computeQuietHoursDeferral({
            nowLocal,
            quietHoursStart: doc.quietHoursStart,
            quietHoursEnd: doc.quietHoursEnd,
          });

          if (existing && existing.scheduledFor && existing.scheduledFor > nowUtc.toJSDate()) {
            return { action: "defer" as const };
          }

          if (inQuiet) {
            if (!existing) {
              await tx.lifeDocReminderEvent.create({
                data: {
                  lifeDocId: r.lifeDocId,
                  recipientUserId,
                  kind: r.kind,
                  daysBeforeExpiry: r.daysBeforeExpiry ?? null,
                  scheduledFor: nextAllowedUtc,
                  sentAt: null,
                  channel: "in_app",
                  dedupeKey,
                },
              });
            } else {
              await tx.lifeDocReminderEvent.update({
                where: { dedupeKey },
                data: { scheduledFor: nextAllowedUtc },
              });
            }
            return { action: "defer" as const };
          }

          const sendAt = nowUtc.toJSDate();
          if (!existing) {
            await tx.lifeDocReminderEvent.create({
              data: {
                lifeDocId: r.lifeDocId,
                recipientUserId,
                kind: r.kind,
                daysBeforeExpiry: r.daysBeforeExpiry ?? null,
                scheduledFor: sendAt,
                sentAt: sendAt,
                channel: "in_app",
                dedupeKey,
              },
            });
          } else {
            await tx.lifeDocReminderEvent.update({
              where: { dedupeKey },
              data: { sentAt: sendAt },
            });
          }

          await tx.notificationEvent.create({
            data: {
              userId: recipientUserId,
              type: "LIFE_DOC_EXPIRY_REMINDER",
              payload: {
                lifeDocId: r.lifeDocId,
                kind: r.kind,
                daysBeforeExpiry: r.daysBeforeExpiry ?? null,
                title: r.title,
                category: r.category,
                subcategory: r.subcategory,
                expiryDate: r.expiryDateIso,
                scheduledFor: r.scheduledFor,
                disclaimer: DISCLAIMER,
              },
            },
            select: { id: true },
          });

          // Email outbox (idempotent): create an email reminder event with sentAt=null.
          const existingEmail = await tx.lifeDocReminderEvent.findUnique({
            where: { dedupeKey: emailDedupeKey },
            select: { id: true, sentAt: true },
          });

          if (!existingEmail) {
            await tx.lifeDocReminderEvent.create({
              data: {
                lifeDocId: r.lifeDocId,
                recipientUserId,
                kind: r.kind,
                daysBeforeExpiry: r.daysBeforeExpiry ?? null,
                scheduledFor: sendAt,
                sentAt: null,
                channel: "email",
                dedupeKey: emailDedupeKey,
              },
            });
          }

          await tx.lifeDoc.update({
            where: { id: r.lifeDocId },
            data: { lastRemindedAt: sendAt },
          });

          return {
            action: "sent" as const,
            emailDedupeKey,
            emailShouldSend: !existingEmail?.sentAt,
          };
        });

        if (result.action !== "sent") continue;
        emitted += 1;

        // Attempt email send outside DB transaction.
        if (!result.emailShouldSend) continue;

        try {
          const recipient = await this.prisma.user.findUnique({
            where: { id: recipientUserId },
            select: { email: true },
          });

          const toEmail = recipient?.email;
          if (!toEmail) continue;

          // Masked-mode safe presentation
          const displayTitle = r.maskedMode
            ? (r.aliasTitle && r.aliasTitle.trim().length > 0
                ? r.aliasTitle.trim()
                : "Life Document")
            : r.title;

          const docUrl = `${this.config.webAppUrl}/life-docs/${encodeURIComponent(
            r.lifeDocId,
          )}`;

          await this.mail.sendLifeDocReminderEmail(toEmail, {
            lifeDocId: r.lifeDocId,
            title: displayTitle,
            expiryDateIso: r.maskedHideExpiry ? null : r.expiryDateIso,
            kind: String(r.kind),
            daysBeforeExpiry: r.daysBeforeExpiry ?? null,
            masked: r.maskedMode,
            maskedHideExpiry: r.maskedHideExpiry,
            docUrl,
          });

          // Mark email event as sent.
          if (result.emailDedupeKey) {
            await this.prisma.lifeDocReminderEvent.update({
              where: { dedupeKey: result.emailDedupeKey },
              data: { sentAt: new Date() },
            });
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `Failed to send reminder email for lifeDocId=${r.lifeDocId} recipientUserId=${recipientUserId}: ${message}`,
          );
        }
      }
    }

    return { scanned: candidates.length, emitted };
  }

  private safeOpenAcl(sealed: any): LifeDocAclPayload {
    try {
      return this.crypto.openJson<LifeDocAclPayload>(sealed);
    } catch {
      return defaultAclPayload();
    }
  }

  private buildDedupeKey(params: {
    lifeDocId: string;
    recipientUserId: string;
    kind: LifeDocReminderKind;
    scheduledFor: string;
    daysBeforeExpiry?: number | null;
  }): string {
    const base = `${params.lifeDocId}:${params.recipientUserId}:${params.kind}:${params.scheduledFor}`;
    if (params.kind === LifeDocReminderKind.CUSTOM) {
      return `${base}:${params.daysBeforeExpiry ?? ""}`;
    }
    return base;
  }

  private computeQuietHoursDeferral(params: {
    nowLocal: DateTime;
    quietHoursStart: string | null;
    quietHoursEnd: string | null;
  }): { inQuiet: boolean; nextAllowedUtc: Date } {
    const start = this.parseHm(params.quietHoursStart);
    const end = this.parseHm(params.quietHoursEnd);
    if (!start || !end) {
      return { inQuiet: false, nextAllowedUtc: params.nowLocal.toUTC().toJSDate() };
    }

    const nowMinutes = params.nowLocal.hour * 60 + params.nowLocal.minute;
    const startMinutes = start.hour * 60 + start.minute;
    const endMinutes = end.hour * 60 + end.minute;

    const spansMidnight = startMinutes > endMinutes;
    const inQuiet = spansMidnight
      ? nowMinutes >= startMinutes || nowMinutes < endMinutes
      : nowMinutes >= startMinutes && nowMinutes < endMinutes;

    if (!inQuiet) {
      return { inQuiet: false, nextAllowedUtc: params.nowLocal.toUTC().toJSDate() };
    }

    let next = params.nowLocal;
    if (!spansMidnight) {
      next = next.set({ hour: end.hour, minute: end.minute, second: 0, millisecond: 0 });
    } else {
      if (nowMinutes >= startMinutes) {
        next = next
          .plus({ days: 1 })
          .set({ hour: end.hour, minute: end.minute, second: 0, millisecond: 0 });
      } else {
        next = next.set({ hour: end.hour, minute: end.minute, second: 0, millisecond: 0 });
      }
    }

    return { inQuiet: true, nextAllowedUtc: next.toUTC().toJSDate() };
  }

  private parseHm(value: string | null): { hour: number; minute: number } | null {
    if (!value) return null;
    const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
    if (!m) return null;
    return { hour: Number(m[1]), minute: Number(m[2]) };
  }

  private computeRecipients(ownerId: string, acl: LifeDocAclPayload): string[] {
    const recipients = new Set<string>();
    recipients.add(ownerId);

    if (acl.notifySharedMembers) {
      for (const m of acl.sharedMembers) {
        recipients.add(m.userId);
      }
    }

    // Guardian notifications are intentionally not sent by default in Phase 1.

    return Array.from(recipients);
  }

  getReminderDisclaimer(): string {
    return DISCLAIMER;
  }
}
