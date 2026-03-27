import type { ApiRequestOptions } from "@/types/api";

import {
  createMockAnalytics,
  createMockConversation,
  createMockFastShare,
  createMockIdentities,
  createMockIncomingRequests,
  createMockOutgoingRequests,
  createMockPersonas,
  createMockReferral,
  createMockSessionSnapshot,
  createMockTeamAccess,
  createMockUserProfile,
} from "./mock-data";

type MockApiSuccessResult = {
  handled: true;
  ok: true;
  data: unknown;
};

type MockApiErrorResult = {
  handled: true;
  ok: false;
  status: number;
  message: string;
  details?: unknown;
};

type MockApiResult = MockApiSuccessResult | MockApiErrorResult;

let mockConversationStatus = createMockConversation().conversationStatus;
let clearedNudgeAt: string | null = null;

function buildConversation() {
  return createMockConversation(mockConversationStatus);
}

function getPathname(path: string): string {
  return path.split("?")[0] ?? path;
}

function getQueryParam(path: string, key: string): string | null {
  const queryString = path.split("?")[1];

  if (!queryString) {
    return null;
  }

  return new URLSearchParams(queryString).get(key);
}

function success(data: unknown): MockApiSuccessResult {
  return {
    handled: true,
    ok: true,
    data,
  };
}

function failure(
  status: number,
  message: string,
  details?: unknown,
): MockApiErrorResult {
  return {
    handled: true,
    ok: false,
    status,
    message,
    details,
  };
}

export function resolveMockApiRequest(
  path: string,
  options: ApiRequestOptions = {},
): MockApiResult | null {
  const pathname = getPathname(path);

  if (pathname === "/api/auth/login" || pathname === "/api/auth/signup") {
    return null;
  }

  if (pathname === "/users/me" || pathname === "/api/users/me") {
    return success(createMockUserProfile());
  }

  if (pathname === "/api/auth/session") {
    return success(createMockSessionSnapshot());
  }

  if (pathname === "/me/analytics" || pathname === "/api/users/me/analytics") {
    return success(createMockAnalytics());
  }

  if (
    pathname === "/users/me/referral" ||
    pathname === "/api/users/me/referral"
  ) {
    return success(createMockReferral());
  }

  if (pathname === "/personas" || pathname === "/api/personas") {
    return success(
      createMockIdentities().length > 0 ? createMockPersonas() : [],
    );
  }

  if (
    pathname === "/personas/me/share-fast" ||
    pathname === "/api/personas/me/share-fast"
  ) {
    return success(createMockFastShare());
  }

  if (
    (pathname.startsWith("/personas/") ||
      pathname.startsWith("/api/personas/")) &&
    pathname.endsWith("/share-fast")
  ) {
    const fastShare = createMockFastShare();

    if (!fastShare.persona || !fastShare.share) {
      return failure(404, "Share unavailable.");
    }

    return success({
      personaId: fastShare.persona.id,
      publicIdentifier: fastShare.persona.publicIdentifier,
      username: fastShare.persona.username,
      fullName: fastShare.persona.fullName,
      profilePhotoUrl: fastShare.persona.profilePhotoUrl,
      shareUrl: fastShare.share.shareUrl,
      qrValue: fastShare.share.qrValue,
      primaryAction: fastShare.share.primaryAction,
      effectiveActions: fastShare.share.effectiveActions,
      preferredShareType: fastShare.share.preferredShareType,
      hasQuickConnect: false,
      quickConnectUrl: null,
    });
  }

  if (
    pathname === "/contact-requests/incoming" ||
    pathname === "/api/contact-requests/incoming"
  ) {
    return success(createMockIncomingRequests());
  }

  if (
    pathname === "/contact-requests/outgoing" ||
    pathname === "/api/contact-requests/outgoing"
  ) {
    return success(createMockOutgoingRequests());
  }

  if (pathname === "/identities" || pathname === "/api/identities") {
    return success(createMockIdentities());
  }

  if (pathname.match(/^\/api\/identities\/[^/]+\/team-access$/)) {
    return success(createMockTeamAccess());
  }

  if (pathname.match(/^\/identities\/[^/]+\/conversations$/)) {
    const status = getQueryParam(path, "status");
    const conversation = buildConversation();

    if (status && conversation.conversationStatus !== status) {
      return success([]);
    }

    return success([conversation]);
  }

  if (pathname.match(/^\/identity-conversations\/[^/]+\/status$/)) {
    const requestedStatus =
      typeof options.body === "object" &&
      options.body !== null &&
      "status" in options.body
        ? String((options.body as { status?: string }).status ?? "")
        : "";

    if (!requestedStatus) {
      return failure(400, "Status is required.");
    }

    mockConversationStatus = requestedStatus as typeof mockConversationStatus;
    return success(buildConversation());
  }

  if (
    pathname === "/api/notifications/count-unread" ||
    pathname === "/notifications/count-unread"
  ) {
    return success({ unreadCount: 3 });
  }

  if (
    pathname.match(
      /^\/users\/me\/activation\/first-response-nudges\/[^/]+\/clear$/,
    )
  ) {
    const queue = pathname.split("/")[5] ?? "requests";
    clearedNudgeAt = new Date().toISOString();

    return success({
      cleared: true,
      queue,
      clearedAt: clearedNudgeAt,
    });
  }

  if (
    pathname.match(
      /^\/api\/users\/me\/activation\/first-response-nudges\/[^/]+\/clear$/,
    )
  ) {
    const queue = pathname.split("/")[6] ?? "requests";
    clearedNudgeAt = new Date().toISOString();

    return success({
      cleared: true,
      queue,
      clearedAt: clearedNudgeAt,
    });
  }

  return null;
}
