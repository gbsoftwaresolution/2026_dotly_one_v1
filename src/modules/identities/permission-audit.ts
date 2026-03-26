import { Inject, Injectable, Optional } from "@nestjs/common";

export const PERMISSION_AUDIT_MAX_EVENTS = "PERMISSION_AUDIT_MAX_EVENTS";

export enum PermissionAuditEventType {
  ResolutionComputed = "RESOLUTION_COMPUTED",
  ActionEnforced = "ACTION_ENFORCED",
  CallEnforced = "CALL_ENFORCED",
  AIEnforced = "AI_ENFORCED",
  ContentResolved = "CONTENT_RESOLVED",
  ConversationBound = "CONVERSATION_BOUND",
  CacheInvalidated = "CACHE_INVALIDATED",
  SnapshotPersisted = "SNAPSHOT_PERSISTED",
}

export interface PermissionAuditEvent {
  id: string;
  eventType: PermissionAuditEventType;
  connectionId: string | null;
  conversationId: string | null;
  permissionKey: string | null;
  actorIdentityId: string | null;
  subjectIdentityId: string | null;
  contentId: string | null;
  summaryText: string;
  payloadJson: Record<string, unknown> | null;
  createdAt: Date;
}

export interface PermissionAuditEventRecordInput {
  eventType: PermissionAuditEventType;
  connectionId?: string | null;
  conversationId?: string | null;
  permissionKey?: string | null;
  actorIdentityId?: string | null;
  subjectIdentityId?: string | null;
  contentId?: string | null;
  summaryText: string;
  payloadJson?: Record<string, unknown> | null;
  createdAt?: Date;
}

export interface ListPermissionAuditEventsFilter {
  eventType?: PermissionAuditEventType;
  connectionId?: string;
  conversationId?: string;
  actorIdentityId?: string;
  limit?: number;
}

@Injectable()
export class PermissionAuditService {
  private readonly events: PermissionAuditEvent[] = [];

  private sequence = 0;

  constructor(
    @Optional()
    @Inject(PERMISSION_AUDIT_MAX_EVENTS)
    private readonly maxEvents = 500,
  ) {}

  async recordEvent(
    input: PermissionAuditEventRecordInput,
  ): Promise<PermissionAuditEvent> {
    this.sequence += 1;

    const event: PermissionAuditEvent = {
      id: `permission-audit-${this.sequence}`,
      eventType: input.eventType,
      connectionId: input.connectionId ?? null,
      conversationId: input.conversationId ?? null,
      permissionKey: input.permissionKey ?? null,
      actorIdentityId: input.actorIdentityId ?? null,
      subjectIdentityId: input.subjectIdentityId ?? null,
      contentId: input.contentId ?? null,
      summaryText: input.summaryText,
      payloadJson: input.payloadJson ?? null,
      createdAt: input.createdAt ?? new Date(),
    };

    this.events.push(event);
    const overflow = this.events.length - this.maxEvents;

    if (overflow > 0) {
      this.events.splice(0, overflow);
    }

    return event;
  }

  async listEvents(
    filter: ListPermissionAuditEventsFilter = {},
  ): Promise<PermissionAuditEvent[]> {
    const limit = clampAuditLimit(filter.limit);

    return this.events
      .filter((event) => {
        if (filter.eventType && event.eventType !== filter.eventType) {
          return false;
        }
        if (filter.connectionId && event.connectionId !== filter.connectionId) {
          return false;
        }
        if (
          filter.conversationId &&
          event.conversationId !== filter.conversationId
        ) {
          return false;
        }
        if (
          filter.actorIdentityId &&
          event.actorIdentityId !== filter.actorIdentityId
        ) {
          return false;
        }
        return true;
      })
      .sort((left, right) => {
        const createdAtDelta =
          right.createdAt.getTime() - left.createdAt.getTime();

        if (createdAtDelta !== 0) {
          return createdAtDelta;
        }

        return right.id.localeCompare(left.id);
      })
      .slice(0, limit);
  }
}

function clampAuditLimit(limit?: number): number {
  if (typeof limit !== "number" || Number.isNaN(limit)) {
    return 50;
  }

  return Math.max(1, Math.min(100, Math.trunc(limit)));
}
