import { strict as assert } from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";

import { INestApplication, Module, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";

import { GlobalExceptionFilter } from "../src/common/filters/global-exception.filter";
import { JwtAuthGuard } from "../src/common/guards/jwt-auth.guard";
import { ResponseEnvelopeInterceptor } from "../src/common/interceptors/response-envelope.interceptor";
import { PrismaService } from "../src/infrastructure/database/prisma.service";
import { DeviceSessionService } from "../src/modules/auth/device-session.service";
import { ActionType } from "../src/modules/identities/action-permission";
import { AIEnforcementService } from "../src/modules/identities/ai-enforcement.service";
import {
  AIExecutionContext,
  AICapability,
} from "../src/modules/identities/ai-permission";
import { ActionEnforcementService } from "../src/modules/identities/action-enforcement.service";
import {
  CallInitiationMode,
  CallType,
} from "../src/modules/identities/call-permission";
import { CallEnforcementService } from "../src/modules/identities/call-enforcement.service";
import { ContentAccessRulesController } from "../src/modules/identities/content-access-rules.controller";
import { CreateConnectionDto } from "../src/modules/identities/dto/create-connection.dto";
import { CreateConversationDto } from "../src/modules/identities/dto/create-conversation.dto";
import { CreateIdentityDto } from "../src/modules/identities/dto/create-identity.dto";
import { IdentitiesController } from "../src/modules/identities/identities.controller";
import { IdentityConversationsController } from "../src/modules/identities/identity-conversations.controller";
import { IdentitiesService } from "../src/modules/identities/identities.service";
import { PermissionAuditController } from "../src/modules/identities/permission-audit.controller";
import { PermissionAuditEventType } from "../src/modules/identities/permission-audit";
import { PERMISSION_KEYS } from "../src/modules/identities/permission-keys";

const JWT_ISSUER = "dotly-backend";
const JWT_AUDIENCE = "dotly-clients";
const JWT_SECRET = "test-secret";
const TEST_SESSION_ID = "session-current";

const createIdentityCalls: unknown[] = [];
const createConnectionCalls: unknown[] = [];
const getConnectionCalls: unknown[] = [];
const listConnectionsCalls: unknown[] = [];
const updateConnectionTypeCalls: unknown[] = [];
const updateTrustStateCalls: unknown[] = [];
const updateRelationshipTypeCalls: unknown[] = [];
const setPermissionOverrideCalls: unknown[] = [];
const listOverridesCalls: unknown[] = [];
const resolvePermissionsCalls: unknown[] = [];
const explainPermissionCalls: unknown[] = [];
const explainPermissionsCalls: unknown[] = [];
const diffPermissionsCalls: unknown[] = [];
const createConversationCalls: unknown[] = [];
const getConversationCalls: unknown[] = [];
const listConversationsCalls: unknown[] = [];
const updateConversationStatusCalls: unknown[] = [];
const resolveConversationContextCalls: unknown[] = [];
const bindPermissionCalls: unknown[] = [];
const staleCalls: unknown[] = [];
const setContentRuleCalls: unknown[] = [];
const getContentRuleCalls: unknown[] = [];
const resolveContentPermissionsCalls: unknown[] = [];
const enforceActionCalls: unknown[] = [];
const enforceCallCalls: unknown[] = [];
const enforceAICalls: unknown[] = [];
const listAuditCalls: unknown[] = [];
const explainConversationContextCalls: unknown[] = [];

function resetCalls() {
  createIdentityCalls.length = 0;
  createConnectionCalls.length = 0;
  getConnectionCalls.length = 0;
  listConnectionsCalls.length = 0;
  updateConnectionTypeCalls.length = 0;
  updateTrustStateCalls.length = 0;
  updateRelationshipTypeCalls.length = 0;
  setPermissionOverrideCalls.length = 0;
  listOverridesCalls.length = 0;
  resolvePermissionsCalls.length = 0;
  explainPermissionCalls.length = 0;
  explainPermissionsCalls.length = 0;
  diffPermissionsCalls.length = 0;
  createConversationCalls.length = 0;
  getConversationCalls.length = 0;
  listConversationsCalls.length = 0;
  updateConversationStatusCalls.length = 0;
  resolveConversationContextCalls.length = 0;
  bindPermissionCalls.length = 0;
  staleCalls.length = 0;
  setContentRuleCalls.length = 0;
  getContentRuleCalls.length = 0;
  resolveContentPermissionsCalls.length = 0;
  enforceActionCalls.length = 0;
  enforceCallCalls.length = 0;
  enforceAICalls.length = 0;
  listAuditCalls.length = 0;
  explainConversationContextCalls.length = 0;
}

const identitiesServiceMock = {
  createIdentity: async (payload: CreateIdentityDto) => {
    createIdentityCalls.push(payload);
    return { id: "identity-1", ...payload };
  },
  createConnection: async (payload: CreateConnectionDto) => {
    createConnectionCalls.push(payload);
    return { id: "connection-1", ...payload };
  },
  getConnectionById: async (payload: { connectionId: string }) => {
    getConnectionCalls.push(payload);
    return { id: payload.connectionId };
  },
  listConnectionsForIdentity: async (payload: unknown) => {
    listConnectionsCalls.push(payload);
    return [];
  },
  updateConnectionType: async (payload: unknown) => {
    updateConnectionTypeCalls.push(payload);
    return payload;
  },
  updateTrustState: async (payload: unknown) => {
    updateTrustStateCalls.push(payload);
    return payload;
  },
  updateConnectionRelationshipType: async (payload: unknown) => {
    updateRelationshipTypeCalls.push(payload);
    return payload;
  },
  setPermissionOverride: async (payload: unknown) => {
    setPermissionOverrideCalls.push(payload);
    return payload;
  },
  listPermissionOverridesForConnection: async (payload: unknown) => {
    listOverridesCalls.push(payload);
    return [];
  },
  resolveConnectionPermissions: async (payload: unknown) => {
    resolvePermissionsCalls.push(payload);
    return { connectionId: "connection-1", permissions: {} };
  },
  explainResolvedPermission: async (payload: unknown) => {
    explainPermissionCalls.push(payload);
    return { permissionKey: PERMISSION_KEYS.mediaPrivacy.export };
  },
  explainResolvedPermissions: async (payload: unknown) => {
    explainPermissionsCalls.push(payload);
    return { connection: { id: "connection-1" } };
  },
  diffCurrentPermissionsAgainstSnapshot: async (payload: unknown) => {
    diffPermissionsCalls.push(payload);
    return { status: "NO_SNAPSHOT" };
  },
  createConversation: async (payload: CreateConversationDto) => {
    createConversationCalls.push(payload);
    return { conversationId: "conversation-1", ...payload };
  },
  getConversationById: async (payload: unknown) => {
    getConversationCalls.push(payload);
    return { conversationId: "conversation-1" };
  },
  listConversationsForIdentity: async (payload: unknown) => {
    listConversationsCalls.push(payload);
    return [];
  },
  updateConversationStatus: async (payload: unknown) => {
    updateConversationStatusCalls.push(payload);
    return payload;
  },
  resolveConversationContext: async (payload: unknown) => {
    resolveConversationContextCalls.push(payload);
    return { stale: false };
  },
  bindResolvedPermissionsToConversation: async (payload: unknown) => {
    bindPermissionCalls.push(payload);
    return { stale: false };
  },
  isConversationPermissionBindingStale: async (conversationId: string) => {
    staleCalls.push(conversationId);
    return { stale: false };
  },
  setContentAccessRule: async (payload: unknown) => {
    setContentRuleCalls.push(payload);
    return payload;
  },
  getContentAccessRule: async (payload: unknown) => {
    getContentRuleCalls.push(payload);
    return payload;
  },
  resolveContentPermissionsForConnection: async (payload: unknown) => {
    resolveContentPermissionsCalls.push(payload);
    return { connection: { id: "connection-1" } };
  },
  listPermissionAuditEvents: async (payload: unknown) => {
    listAuditCalls.push(payload);
    return [];
  },
  explainConversationPermissionContext: async (payload: unknown) => {
    explainConversationContextCalls.push(payload);
    return { conversationId: "conversation-1" };
  },
};

const actionEnforcementServiceMock = {
  enforceAction: async (payload: unknown) => {
    enforceActionCalls.push(payload);
    return { allowed: true };
  },
};

const callEnforcementServiceMock = {
  enforceCall: async (payload: unknown) => {
    enforceCallCalls.push(payload);
    return { allowed: true };
  },
};

const aiEnforcementServiceMock = {
  enforceAICapability: async (payload: unknown) => {
    enforceAICalls.push(payload);
    return { allowed: true };
  },
};

const configServiceMock = {
  get: (key: string, fallback?: string) => {
    switch (key) {
      case "jwt.issuer":
        return JWT_ISSUER;
      case "jwt.audience":
        return JWT_AUDIENCE;
      default:
        return fallback;
    }
  },
};

const deviceSessionServiceMock = {
  validateSession: async (_userId: string, sessionId: string) => ({
    status: "active" as const,
    session: {
      id: sessionId,
      expiresAt: new Date("2026-03-28T09:00:00.000Z"),
    },
  }),
};

const prismaServiceMock = {
  user: {
    findUnique: async (args: { where: { id: string } }) => ({
      id: args.where.id,
      email: "user@example.com",
      isVerified: true,
    }),
  },
};

const jwtService = new JwtService({
  secret: JWT_SECRET,
  signOptions: {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    expiresIn: "1h",
  },
});

@Module({
  controllers: [
    IdentitiesController,
    IdentityConversationsController,
    ContentAccessRulesController,
    PermissionAuditController,
  ],
  providers: [
    JwtAuthGuard,
    {
      provide: JwtService,
      useValue: jwtService,
    },
    {
      provide: IdentitiesService,
      useValue: identitiesServiceMock,
    },
    {
      provide: ConfigService,
      useValue: configServiceMock,
    },
    {
      provide: DeviceSessionService,
      useValue: deviceSessionServiceMock,
    },
    {
      provide: PrismaService,
      useValue: prismaServiceMock,
    },
    {
      provide: ActionEnforcementService,
      useValue: actionEnforcementServiceMock,
    },
    {
      provide: CallEnforcementService,
      useValue: callEnforcementServiceMock,
    },
    {
      provide: AIEnforcementService,
      useValue: aiEnforcementServiceMock,
    },
  ],
})
class IdentitiesHttpTestModule {}

describe("Identities HTTP E2E", () => {
  let app: INestApplication;
  let baseUrl = "";

  beforeEach(() => {
    resetCalls();
  });

  before(async () => {
    const moduleRef = await NestFactory.create(IdentitiesHttpTestModule, {
      logger: false,
    });

    app = moduleRef;
    app.setGlobalPrefix("v1");
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
    app.useGlobalFilters(
      new GlobalExceptionFilter({
        error: () => undefined,
      } as any),
    );

    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  after(async () => {
    await app.close();
  });

  async function authHeaders() {
    const token = await jwtService.signAsync({
      sub: "user-84",
      email: "user84@example.com",
      sessionId: TEST_SESSION_ID,
    });

    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  it("creates an identity through POST /identities", async () => {
    const response = await fetch(`${baseUrl}/v1/identities`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({
        identityType: "personal",
        displayName: "Alice Identity",
        verificationLevel: "basic",
        status: "active",
      }),
    });

    assert.equal(response.status, 201);
    assert.equal(createIdentityCalls.length, 1);
  });

  it("creates a connection through POST /identity-connections", async () => {
    const response = await fetch(`${baseUrl}/v1/identity-connections`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({
        sourceIdentityId: "11111111-1111-4111-8111-111111111111",
        targetIdentityId: "22222222-2222-4222-8222-222222222222",
        connectionType: "known",
        trustState: "basic_verified",
        status: "active",
        createdByIdentityId: "11111111-1111-4111-8111-111111111111",
      }),
    });

    assert.equal(response.status, 201);
    assert.equal(createConnectionCalls.length, 1);
  });

  it("gets and lists connections", async () => {
    const headers = await authHeaders();
    const getResponse = await fetch(
      `${baseUrl}/v1/identity-connections/11111111-1111-4111-8111-111111111111`,
      { headers },
    );
    const listResponse = await fetch(
      `${baseUrl}/v1/identities/11111111-1111-4111-8111-111111111111/connections?status=active`,
      { headers },
    );

    assert.equal(getResponse.status, 200);
    assert.equal(listResponse.status, 200);
    assert.equal(getConnectionCalls.length, 1);
    assert.equal(listConnectionsCalls.length, 1);
  });

  it("updates trust and relationship fields", async () => {
    const headers = await authHeaders();
    const trustResponse = await fetch(
      `${baseUrl}/v1/identity-connections/11111111-1111-4111-8111-111111111111/trust-state`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ trustState: "trusted_by_user" }),
      },
    );
    const relationshipResponse = await fetch(
      `${baseUrl}/v1/identity-connections/11111111-1111-4111-8111-111111111111/relationship-type`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ relationshipType: "client" }),
      },
    );

    assert.equal(trustResponse.status, 200);
    assert.equal(relationshipResponse.status, 200);
    assert.equal(updateTrustStateCalls.length, 1);
    assert.equal(updateRelationshipTypeCalls.length, 1);
  });

  it("updates connection type and manages permission overrides", async () => {
    const headers = await authHeaders();
    const typeResponse = await fetch(
      `${baseUrl}/v1/identity-connections/11111111-1111-4111-8111-111111111111/type`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ connectionType: "trusted" }),
      },
    );
    const setOverrideResponse = await fetch(
      `${baseUrl}/v1/identity-connections/11111111-1111-4111-8111-111111111111/permission-overrides/${encodeURIComponent(PERMISSION_KEYS.messaging.textSend)}`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({
          effect: "allow_with_limits",
          limitsJson: { maxUses: 3 },
          reason: "Approved",
          createdByIdentityId: "22222222-2222-4222-8222-222222222222",
        }),
      },
    );
    const listOverrideResponse = await fetch(
      `${baseUrl}/v1/identity-connections/11111111-1111-4111-8111-111111111111/permission-overrides`,
      { headers },
    );

    assert.equal(typeResponse.status, 200);
    assert.equal(setOverrideResponse.status, 200);
    assert.equal(listOverrideResponse.status, 200);
    assert.equal(updateConnectionTypeCalls.length, 1);
    assert.equal(setPermissionOverrideCalls.length, 1);
    assert.equal(listOverridesCalls.length, 1);
  });

  it("resolves and explains permissions", async () => {
    const headers = await authHeaders();
    const resolvedResponse = await fetch(
      `${baseUrl}/v1/identity-connections/11111111-1111-4111-8111-111111111111/resolved-permissions?preferCache=true&forceRefresh=false`,
      { headers },
    );
    const explainOneResponse = await fetch(
      `${baseUrl}/v1/identity-connections/11111111-1111-4111-8111-111111111111/permissions/${encodeURIComponent(PERMISSION_KEYS.mediaPrivacy.export)}/explain?verbosity=DETAILED`,
      { headers },
    );
    const explainAllResponse = await fetch(
      `${baseUrl}/v1/identity-connections/11111111-1111-4111-8111-111111111111/permissions/explain?preferSnapshot=true`,
      { headers },
    );
    const diffResponse = await fetch(
      `${baseUrl}/v1/identity-connections/11111111-1111-4111-8111-111111111111/permissions/diff-against-snapshot`,
      { headers },
    );

    assert.equal(resolvedResponse.status, 200);
    assert.equal(explainOneResponse.status, 200);
    assert.equal(explainAllResponse.status, 200);
    assert.equal(diffResponse.status, 200);
    assert.equal(resolvePermissionsCalls.length, 1);
    assert.equal(explainPermissionCalls.length, 1);
    assert.equal(explainPermissionsCalls.length, 1);
    assert.equal(diffPermissionsCalls.length, 1);
  });

  it("creates, gets, lists, and updates conversation endpoints", async () => {
    const headers = await authHeaders();
    const createResponse = await fetch(`${baseUrl}/v1/identity-conversations`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        sourceIdentityId: "11111111-1111-4111-8111-111111111111",
        targetIdentityId: "22222222-2222-4222-8222-222222222222",
        connectionId: "33333333-3333-4333-8333-333333333333",
        conversationType: "DIRECT",
        createdByIdentityId: "11111111-1111-4111-8111-111111111111",
      }),
    });
    const getResponse = await fetch(
      `${baseUrl}/v1/identity-conversations/11111111-1111-4111-8111-111111111111`,
      { headers },
    );
    const listResponse = await fetch(
      `${baseUrl}/v1/identities/11111111-1111-4111-8111-111111111111/conversations?status=ACTIVE`,
      { headers },
    );
    const updateResponse = await fetch(
      `${baseUrl}/v1/identity-conversations/11111111-1111-4111-8111-111111111111/status`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: "LOCKED" }),
      },
    );

    assert.equal(createResponse.status, 201);
    assert.equal(getResponse.status, 200);
    assert.equal(listResponse.status, 200);
    assert.equal(updateResponse.status, 200);
    assert.equal(createConversationCalls.length, 1);
    assert.equal(getConversationCalls.length, 1);
    assert.equal(listConversationsCalls.length, 1);
    assert.equal(updateConversationStatusCalls.length, 1);
  });

  it("supports bind, stale, context, and explain-context conversation endpoints", async () => {
    const headers = await authHeaders();
    const contextResponse = await fetch(
      `${baseUrl}/v1/identity-conversations/11111111-1111-4111-8111-111111111111/context`,
      { headers },
    );
    const bindResponse = await fetch(
      `${baseUrl}/v1/identity-conversations/11111111-1111-4111-8111-111111111111/bind-permissions`,
      {
        method: "POST",
        headers,
      },
    );
    const staleResponse = await fetch(
      `${baseUrl}/v1/identity-conversations/11111111-1111-4111-8111-111111111111/binding-staleness`,
      { headers },
    );
    const explainResponse = await fetch(
      `${baseUrl}/v1/identity-conversations/11111111-1111-4111-8111-111111111111/explain-context`,
      { headers },
    );

    assert.equal(contextResponse.status, 200);
    assert.equal(bindResponse.status, 201);
    assert.equal(staleResponse.status, 200);
    assert.equal(explainResponse.status, 200);
    assert.equal(resolveConversationContextCalls.length, 1);
    assert.equal(bindPermissionCalls.length, 1);
    assert.equal(staleCalls.length, 1);
    assert.equal(explainConversationContextCalls.length, 1);
  });

  it("supports content rule and content permission endpoints", async () => {
    const headers = await authHeaders();
    const setResponse = await fetch(`${baseUrl}/v1/content-access-rules`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        contentId: "11111111-1111-4111-8111-111111111111",
        targetIdentityId: "22222222-2222-4222-8222-222222222222",
        canView: true,
        createdByIdentityId: "33333333-3333-4333-8333-333333333333",
      }),
    });
    const getResponse = await fetch(
      `${baseUrl}/v1/content-access-rules?contentId=11111111-1111-4111-8111-111111111111&targetIdentityId=22222222-2222-4222-8222-222222222222`,
      { headers },
    );
    const resolveResponse = await fetch(
      `${baseUrl}/v1/identity-connections/11111111-1111-4111-8111-111111111111/content/44444444-4444-4444-8444-444444444444/permissions?targetIdentityId=22222222-2222-4222-8222-222222222222&currentViewCount=2`,
      { headers },
    );

    assert.equal(setResponse.status, 200);
    assert.equal(getResponse.status, 200);
    assert.equal(resolveResponse.status, 200);
    assert.equal(setContentRuleCalls.length, 1);
    assert.equal(getContentRuleCalls.length, 1);
    assert.equal(resolveContentPermissionsCalls.length, 1);
  });

  it("supports enforce-action, enforce-call, and enforce-ai endpoints", async () => {
    const headers = await authHeaders();
    const actionResponse = await fetch(
      `${baseUrl}/v1/identity-conversations/11111111-1111-4111-8111-111111111111/enforce-action`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          actorIdentityId: "22222222-2222-4222-8222-222222222222",
          actionType: ActionType.SendText,
        }),
      },
    );
    const callResponse = await fetch(
      `${baseUrl}/v1/identity-conversations/11111111-1111-4111-8111-111111111111/enforce-call`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          actorIdentityId: "22222222-2222-4222-8222-222222222222",
          callType: CallType.Video,
          initiationMode: CallInitiationMode.Direct,
        }),
      },
    );
    const aiResponse = await fetch(
      `${baseUrl}/v1/identity-conversations/11111111-1111-4111-8111-111111111111/enforce-ai`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          actorIdentityId: "22222222-2222-4222-8222-222222222222",
          capability: AICapability.Summary,
          contextType: AIExecutionContext.Conversation,
        }),
      },
    );

    assert.equal(actionResponse.status, 201);
    assert.equal(callResponse.status, 201);
    assert.equal(aiResponse.status, 201);
    assert.equal(enforceActionCalls.length, 1);
    assert.equal(enforceCallCalls.length, 1);
    assert.equal(enforceAICalls.length, 1);
  });

  it("lists permission audit events", async () => {
    const response = await fetch(
      `${baseUrl}/v1/permission-audit-events?eventType=${PermissionAuditEventType.ActionEnforced}&limit=10`,
      {
        headers: await authHeaders(),
      },
    );

    assert.equal(response.status, 200);
    assert.equal(listAuditCalls.length, 1);
  });

  it("rejects invalid UUID and enum validation before reaching services", async () => {
    const headers = await authHeaders();
    const invalidUuidResponse = await fetch(
      `${baseUrl}/v1/identity-connections/not-a-uuid`,
      { headers },
    );
    const invalidEnumResponse = await fetch(
      `${baseUrl}/v1/identity-connections/11111111-1111-4111-8111-111111111111/trust-state`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ trustState: "NOT_REAL" }),
      },
    );
    const invalidPermissionKeyResponse = await fetch(
      `${baseUrl}/v1/identity-connections/11111111-1111-4111-8111-111111111111/permissions/not.real/explain`,
      { headers },
    );

    assert.equal(invalidUuidResponse.status, 400);
    assert.equal(invalidEnumResponse.status, 400);
    assert.equal(invalidPermissionKeyResponse.status, 400);
    assert.equal(getConnectionCalls.length, 0);
    assert.equal(updateTrustStateCalls.length, 0);
    assert.equal(explainPermissionCalls.length, 0);
  });

  it("requires authentication for the REST surface", async () => {
    const response = await fetch(`${baseUrl}/v1/permission-audit-events`);

    assert.equal(response.status, 401);
  });
});
