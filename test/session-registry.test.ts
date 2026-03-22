import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";

import { AuthMetricsService } from "../src/modules/auth/auth-metrics.service";
import { AuthService } from "../src/modules/auth/auth.service";

interface SessionRecord {
  id: string;
  userId: string;
  deviceLabel: string;
  platformLabel: string;
  createdAt: Date;
  lastActiveAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  revokedReason: string | null;
}

function createSessionHarness(options?: { authMetricsService?: AuthMetricsService }) {
  const now = new Date("2026-03-21T12:00:00.000Z");
  const state = {
    sessions: [
      {
        id: "session-current",
        userId: "user-1",
        deviceLabel: "MacBook Pro · Chrome",
        platformLabel: "macOS",
        createdAt: new Date("2026-03-20T10:00:00.000Z"),
        lastActiveAt: new Date("2026-03-21T11:45:00.000Z"),
        expiresAt: new Date("2026-03-28T10:00:00.000Z"),
        revokedAt: null,
        revokedReason: null,
      },
      {
        id: "session-other",
        userId: "user-1",
        deviceLabel: "iPhone · Safari",
        platformLabel: "iPhone",
        createdAt: new Date("2026-03-19T08:00:00.000Z"),
        lastActiveAt: new Date("2026-03-21T09:30:00.000Z"),
        expiresAt: new Date("2026-03-27T08:00:00.000Z"),
        revokedAt: null,
        revokedReason: null,
      },
      {
        id: "session-revoked",
        userId: "user-1",
        deviceLabel: "Linux · Firefox",
        platformLabel: "Linux",
        createdAt: new Date("2026-03-18T08:00:00.000Z"),
        lastActiveAt: new Date("2026-03-20T08:00:00.000Z"),
        expiresAt: new Date("2026-03-26T08:00:00.000Z"),
        revokedAt: now,
        revokedReason: "logout",
      },
    ] as SessionRecord[],
    revokeCalls: [] as Array<{
      userId: string;
      sessionId: string;
      reason: string;
    }>,
    revokeOtherCalls: [] as Array<{
      userId: string;
      sessionId: string;
      reason: string;
    }>,
    audits: [] as Array<Record<string, unknown>>,
  };

  const deviceSessionService = {
    createSession: async () => ({
      id: "session-created",
      expiresAt: new Date("2026-03-28T12:00:00.000Z"),
    }),
    listSessions: async (userId: string) =>
      state.sessions.filter(
        (session) =>
          session.userId === userId &&
          session.revokedAt === null &&
          session.expiresAt.getTime() > now.getTime(),
      ),
    revokeSession: async (userId: string, sessionId: string, reason: string) => {
      state.revokeCalls.push({ userId, sessionId, reason });
      const session = state.sessions.find(
        (candidate) =>
          candidate.userId === userId &&
          candidate.id === sessionId,
      );

      if (!session) {
        return {
          status: "not_found",
        };
      }

      if (
        session.revokedAt !== null ||
        session.expiresAt.getTime() <= now.getTime()
      ) {
        return {
          status: "already_inactive",
        };
      }

      session.revokedAt = now;
      session.revokedReason = reason;
      return {
        status: "revoked",
        revokedAt: now,
      };
    },
    revokeOtherSessions: async (
      userId: string,
      sessionId: string,
      reason: string,
    ) => {
      state.revokeOtherCalls.push({ userId, sessionId, reason });
      let revokedCount = 0;

      for (const session of state.sessions) {
        if (
          session.userId !== userId ||
          session.id === sessionId ||
          session.revokedAt !== null
        ) {
          continue;
        }

        session.revokedAt = now;
        session.revokedReason = reason;
        revokedCount += 1;
      }

      return revokedCount;
    },
    revokeAllSessions: async () => 0,
  };

  const service = new AuthService(
    {} as any,
    { signAsync: async () => "access-token" } as any,
    { isConfigured: () => true } as any,
    {} as any,
    undefined as any,
    deviceSessionService as any,
    undefined as any,
    undefined as any,
    undefined as any,
    undefined as any,
    {
      log: (event: Record<string, unknown>) => {
        state.audits.push(event);
      },
    } as any,
    options?.authMetricsService,
  );

  return {
    service,
    state,
  };
}

describe("AuthService session registry foundation", () => {
  it("lists active sessions for the current user and flags the current session", async () => {
    const { service } = createSessionHarness();

    const result = await service.listSessions("user-1", "session-current");

    assert.equal(result.sessions.length, 2);
    assert.deepEqual(result.sessions, [
      {
        id: "session-current",
        deviceLabel: "MacBook Pro · Chrome",
        platformLabel: "macOS",
        createdAt: new Date("2026-03-20T10:00:00.000Z"),
        lastActiveAt: new Date("2026-03-21T11:45:00.000Z"),
        expiresAt: new Date("2026-03-28T10:00:00.000Z"),
        isCurrent: true,
      },
      {
        id: "session-other",
        deviceLabel: "iPhone · Safari",
        platformLabel: "iPhone",
        createdAt: new Date("2026-03-19T08:00:00.000Z"),
        lastActiveAt: new Date("2026-03-21T09:30:00.000Z"),
        expiresAt: new Date("2026-03-27T08:00:00.000Z"),
        isCurrent: false,
      },
    ]);
  });

  it("rejects revoking the current session through the remote revoke path", async () => {
    const authMetricsService = new AuthMetricsService();
    const { service, state } = createSessionHarness({ authMetricsService });

    await assert.rejects(
      service.revokeSession("user-1", "session-current", {
        sessionId: "session-current",
      }),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestException);
        assert.equal(
          error.message,
          "Use sign out if you want to leave the current device.",
        );
        return true;
      },
    );

    assert.deepEqual(state.revokeCalls, []);
    assert.equal(
      authMetricsService.getCounterValue("dotly_auth_session_security_total", {
        action: "revoke",
        outcome: "blocked",
        reason: "current_session_protected",
      }),
      1,
    );
  });

  it("revokes a specific other session and records the remote sign-out reason", async () => {
    const authMetricsService = new AuthMetricsService();
    const { service, state } = createSessionHarness({ authMetricsService });

    const result = await service.revokeSession("user-1", "session-current", {
      sessionId: "session-other",
    });

    assert.deepEqual(result, {
      success: true,
    });
    assert.deepEqual(state.revokeCalls, [
      {
        userId: "user-1",
        sessionId: "session-other",
        reason: "remote_sign_out",
      },
    ]);
    assert.equal(
      state.sessions.find((session) => session.id === "session-other")?.revokedReason,
      "remote_sign_out",
    );
    assert.deepEqual(state.audits[0], {
      action: "auth.session.revoke",
      outcome: "success",
      actorUserId: "user-1",
      requestId: undefined,
      sessionId: "session-current",
      targetType: "session",
      targetId: "session-other",
      reason: "remote_sign_out",
      policySource: undefined,
      metadata: undefined,
    });
    assert.equal(
      authMetricsService.getCounterValue("dotly_auth_session_security_total", {
        action: "revoke",
        outcome: "success",
        reason: "remote_sign_out",
      }),
      1,
    );
  });

  it("treats already inactive sessions as an idempotent remote sign-out result", async () => {
    const authMetricsService = new AuthMetricsService();
    const { service, state } = createSessionHarness({ authMetricsService });
    state.sessions.find((session) => session.id === "session-other")!.revokedAt = new Date(
      "2026-03-21T12:00:00.000Z",
    );
    state.sessions.find((session) => session.id === "session-other")!.revokedReason =
      "logout";

    const result = await service.revokeSession("user-1", "session-current", {
      sessionId: "session-other",
    });

    assert.deepEqual(result, {
      success: true,
      alreadyInactive: true,
    });
    assert.equal(
      authMetricsService.getCounterValue("dotly_auth_session_security_total", {
        action: "revoke",
        outcome: "success",
        reason: "already_inactive",
      }),
      1,
    );
    assert.deepEqual(state.audits[0], {
      action: "auth.session.revoke",
      outcome: "success",
      actorUserId: "user-1",
      requestId: undefined,
      sessionId: "session-current",
      targetType: "session",
      targetId: "session-other",
      reason: "already_inactive",
      policySource: undefined,
      metadata: {
        alreadyInactive: true,
      },
    });
  });

  it("returns not found when a requested session cannot be revoked", async () => {
    const { service } = createSessionHarness();

    await assert.rejects(
      service.revokeSession("user-1", "session-current", {
        sessionId: "session-missing",
      }),
      (error: unknown) => {
        assert.ok(error instanceof NotFoundException);
        assert.equal(error.message, "Session not found.");
        return true;
      },
    );
  });

  it("revokes every other active session without touching the current one", async () => {
    const authMetricsService = new AuthMetricsService();
    const { service, state } = createSessionHarness({ authMetricsService });

    const result = await service.revokeOtherSessions("user-1", "session-current");

    assert.deepEqual(result, {
      success: true,
      revokedCount: 1,
    });
    assert.deepEqual(state.revokeOtherCalls, [
      {
        userId: "user-1",
        sessionId: "session-current",
        reason: "sign_out_other_sessions",
      },
    ]);
    assert.equal(
      state.sessions.find((session) => session.id === "session-current")?.revokedAt,
      null,
    );
    assert.equal(
      state.sessions.find((session) => session.id === "session-other")?.revokedReason,
      "sign_out_other_sessions",
    );
    assert.deepEqual(state.audits[0], {
      action: "auth.session.revoke_others",
      outcome: "success",
      actorUserId: "user-1",
      requestId: undefined,
      sessionId: "session-current",
      targetType: undefined,
      targetId: undefined,
      reason: "sign_out_other_sessions",
      policySource: undefined,
      metadata: {
        revokedCount: 1,
      },
    });
    assert.equal(
      authMetricsService.getCounterValue("dotly_auth_session_security_total", {
        action: "revoke_others",
        outcome: "success",
        reason: "sign_out_other_sessions",
      }),
      1,
    );
  });

  it("rejects device-wide revoke actions without a tracked current session id", async () => {
    const { service, state } = createSessionHarness();

    await assert.rejects(
      service.revokeOtherSessions("user-1", ""),
      (error: unknown) => {
        assert.ok(error instanceof UnauthorizedException);
        assert.equal(error.message, "Invalid authentication token");
        return true;
      },
    );

    assert.deepEqual(state.revokeOtherCalls, []);
  });

  it("revokes the current session with the logout reason", async () => {
    const authMetricsService = new AuthMetricsService();
    const { service, state } = createSessionHarness({ authMetricsService });

    const result = await service.revokeCurrentSession("user-1", "session-current");

    assert.deepEqual(result, {
      success: true,
    });
    assert.deepEqual(state.revokeCalls, [
      {
        userId: "user-1",
        sessionId: "session-current",
        reason: "logout",
      },
    ]);
    assert.deepEqual(state.audits[0], {
      action: "auth.session.logout_current",
      outcome: "success",
      actorUserId: "user-1",
      requestId: undefined,
      sessionId: "session-current",
      targetType: undefined,
      targetId: undefined,
      reason: "logout",
      policySource: undefined,
      metadata: undefined,
    });
    assert.equal(
      authMetricsService.getCounterValue("dotly_auth_session_security_total", {
        action: "logout_current",
        outcome: "success",
        reason: "logout",
      }),
      1,
    );
  });
});