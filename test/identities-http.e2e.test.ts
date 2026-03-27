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
const TEST_USER_ID = "user-84";

const createIdentityCalls: unknown[] = [];
const listIdentitiesCalls: unknown[] = [];
const createConnectionCalls: unknown[] = [];
const getConnectionCalls: unknown[] = [];
const listConnectionsCalls: unknown[] = [];
const updateConnectionTypeCalls: unknown[] = [];
const updateTrustStateCalls: unknown[] = [];
const updateRelationshipTypeCalls: unknown[] = [];
const listTeamAccessCalls: unknown[] = [];
const listMembersCalls: unknown[] = [];
const createMemberCalls: unknown[] = [];
const updateMemberCalls: unknown[] = [];
const removeMemberCalls: unknown[] = [];
const listOperatorsCalls: unknown[] = [];
const createOperatorCalls: unknown[] = [];
const updateOperatorCalls: unknown[] = [];
const revokeOperatorCalls: unknown[] = [];
const updateMemberAssignmentsCalls: unknown[] = [];
const updateOperatorAssignmentsCalls: unknown[] = [];
const setPermissionOverrideCalls: unknown[] = [];
const listOverridesCalls: unknown[] = [];
const resolvePermissionsCalls: unknown[] = [];
const explainPermissionCalls: unknown[] = [];
const explainPermissionsCalls: unknown[] = [];
const diffPermissionsCalls: unknown[] = [];
const createConversationCalls: unknown[] = [];
const getOrCreateConversationCalls: unknown[] = [];
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
  listIdentitiesCalls.length = 0;
  createConnectionCalls.length = 0;
  getConnectionCalls.length = 0;
  listConnectionsCalls.length = 0;
  updateConnectionTypeCalls.length = 0;
  updateTrustStateCalls.length = 0;
  updateRelationshipTypeCalls.length = 0;
  listTeamAccessCalls.length = 0;
  listMembersCalls.length = 0;
  createMemberCalls.length = 0;
  updateMemberCalls.length = 0;
  removeMemberCalls.length = 0;
  listOperatorsCalls.length = 0;
  createOperatorCalls.length = 0;
  updateOperatorCalls.length = 0;
  revokeOperatorCalls.length = 0;
  updateMemberAssignmentsCalls.length = 0;
  updateOperatorAssignmentsCalls.length = 0;
  setPermissionOverrideCalls.length = 0;
  listOverridesCalls.length = 0;
  resolvePermissionsCalls.length = 0;
  explainPermissionCalls.length = 0;
  explainPermissionsCalls.length = 0;
  diffPermissionsCalls.length = 0;
  createConversationCalls.length = 0;
  getOrCreateConversationCalls.length = 0;
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
  listIdentitiesForUser: async (userId: string) => {
    listIdentitiesCalls.push(userId);
    return [
      {
        id: "identity-1",
        personId: userId,
        identityType: "personal",
        displayName: "Grandpa Joe",
        handle: "grandpa-joe",
        verificationLevel: "basic_verified",
        status: "active",
        metadataJson: null,
      },
    ];
  },
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
    return {
      id: payload.connectionId,
      sourceIdentityId: "identity-source",
      targetIdentityId: "identity-target",
      sourceIdentity: {
        id: "identity-source",
        displayName: "Source Identity",
        handle: "source",
        identityType: "personal",
        verificationLevel: "basic",
        status: "active",
      },
      targetIdentity: {
        id: "identity-target",
        displayName: "Target Identity",
        handle: "target",
        identityType: "business",
        verificationLevel: "verified",
        status: "active",
      },
    };
  },
  listConnectionsForIdentity: async (payload: unknown) => {
    listConnectionsCalls.push(payload);
    return [
      {
        id: "connection-1",
        sourceIdentityId: "identity-source",
        targetIdentityId: "identity-target",
        connectionType: "known",
        relationshipType: "friend",
        trustState: "basic_verified",
        status: "active",
        createdByIdentityId: "identity-source",
        note: null,
        metadataJson: null,
        createdAt: new Date("2026-03-26T10:00:00.000Z"),
        updatedAt: new Date("2026-03-26T10:00:00.000Z"),
        sourceIdentity: {
          id: "identity-source",
          displayName: "Source Identity",
          handle: "source",
          identityType: "personal",
          verificationLevel: "basic",
          status: "active",
        },
        targetIdentity: {
          id: "identity-target",
          displayName: "Target Identity",
          handle: "target",
          identityType: "business",
          verificationLevel: "verified",
          status: "active",
        },
      },
    ];
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
  getIdentityTeamPersonaAccess: async (userId: string, identityId: string) => {
    listTeamAccessCalls.push({ userId, identityId });
    return {
      identity: {
        id: identityId,
        displayName: "Source Identity",
        handle: "source",
      },
      personas: [
        {
          id: "persona-1",
          username: "alpha",
          fullName: "Alpha Persona",
          routingKey: "alpha",
          routingDisplayName: "Alpha",
          isDefaultRouting: true,
        },
      ],
      members: [
        {
          id: "member-1",
          personId: "user-member",
          email: "member@dotly.one",
          role: "OWNER",
          status: "ACTIVE",
          assignedPersonaIds: ["persona-1"],
          assignedPersonas: [
            {
              id: "persona-1",
              username: "alpha",
              fullName: "Alpha Persona",
              routingKey: "alpha",
              routingDisplayName: "Alpha",
              isDefaultRouting: true,
            },
          ],
          accessMode: "restricted",
        },
      ],
      operators: [
        {
          id: "operator-1",
          personId: "user-operator",
          email: "operator@dotly.one",
          role: "ADMIN",
          status: "ACTIVE",
          assignedPersonaIds: [],
          assignedPersonas: [],
          accessMode: "full",
        },
      ],
    };
  },
  listIdentityMembers: async (userId: string, identityId: string) => {
    listMembersCalls.push({ userId, identityId });
    return {
      identity: {
        id: identityId,
        displayName: "Source Identity",
        handle: "source",
      },
      members: [
        {
          id: "member-1",
          personId: "user-member",
          email: "member@dotly.one",
          role: "OWNER",
          status: "ACTIVE",
          assignedPersonaIds: ["persona-1"],
          assignedPersonas: [
            {
              id: "persona-1",
              username: "alpha",
              fullName: "Alpha Persona",
              routingKey: "alpha",
              routingDisplayName: "Alpha",
              isDefaultRouting: true,
            },
          ],
          accessMode: "restricted",
        },
      ],
    };
  },
  createIdentityMember: async (userId: string, payload: unknown) => {
    createMemberCalls.push({ userId, payload });
    return {
      id: "member-2",
      personId: "user-new-member",
      email: "new-member@dotly.one",
      role: "MANAGER",
      status: "INVITED",
      assignedPersonaIds: ["persona-1"],
      assignedPersonas: [
        {
          id: "persona-1",
          username: "alpha",
          fullName: "Alpha Persona",
          routingKey: "alpha",
          routingDisplayName: "Alpha",
          isDefaultRouting: true,
        },
      ],
      accessMode: "restricted",
    };
  },
  updateIdentityMember: async (userId: string, payload: unknown) => {
    updateMemberCalls.push({ userId, payload });
    return {
      id: "member-1",
      personId: "user-member",
      email: "member@dotly.one",
      role: "MANAGER",
      status: "SUSPENDED",
      assignedPersonaIds: ["persona-1"],
      assignedPersonas: [
        {
          id: "persona-1",
          username: "alpha",
          fullName: "Alpha Persona",
          routingKey: "alpha",
          routingDisplayName: "Alpha",
          isDefaultRouting: true,
        },
      ],
      accessMode: "restricted",
    };
  },
  removeIdentityMemberAccess: async (userId: string, payload: unknown) => {
    removeMemberCalls.push({ userId, payload });
    return {
      id: "member-1",
      personId: "user-member",
      email: "member@dotly.one",
      role: "MANAGER",
      status: "REMOVED",
      assignedPersonaIds: [],
      assignedPersonas: [],
      accessMode: "full",
    };
  },
  listIdentityOperators: async (userId: string, identityId: string) => {
    listOperatorsCalls.push({ userId, identityId });
    return {
      identity: {
        id: identityId,
        displayName: "Source Identity",
        handle: "source",
      },
      operators: [
        {
          id: "operator-1",
          personId: "user-operator",
          email: "operator@dotly.one",
          role: "ADMIN",
          status: "ACTIVE",
          assignedPersonaIds: [],
          assignedPersonas: [],
          accessMode: "full",
        },
      ],
    };
  },
  createIdentityOperator: async (userId: string, payload: unknown) => {
    createOperatorCalls.push({ userId, payload });
    return {
      id: "operator-2",
      personId: "user-new-operator",
      email: "new-operator@dotly.one",
      role: "OPERATOR",
      status: "INVITED",
      assignedPersonaIds: [],
      assignedPersonas: [],
      accessMode: "full",
    };
  },
  updateIdentityOperator: async (userId: string, payload: unknown) => {
    updateOperatorCalls.push({ userId, payload });
    return {
      id: "operator-1",
      personId: "user-operator",
      email: "operator@dotly.one",
      role: "OPERATOR",
      status: "ACTIVE",
      assignedPersonaIds: [],
      assignedPersonas: [],
      accessMode: "full",
    };
  },
  revokeIdentityOperatorAccess: async (userId: string, payload: unknown) => {
    revokeOperatorCalls.push({ userId, payload });
    return {
      id: "operator-1",
      personId: "user-operator",
      email: "operator@dotly.one",
      role: "OPERATOR",
      status: "REVOKED",
      assignedPersonaIds: [],
      assignedPersonas: [],
      accessMode: "full",
    };
  },
  updateIdentityMemberPersonaAssignments: async (
    userId: string,
    payload: unknown,
  ) => {
    updateMemberAssignmentsCalls.push({ userId, payload });
    return {
      id: "member-1",
      personId: "user-member",
      email: "member@dotly.one",
      role: "OWNER",
      status: "ACTIVE",
      assignedPersonaIds: ["persona-1"],
      assignedPersonas: [
        {
          id: "persona-1",
          username: "alpha",
          fullName: "Alpha Persona",
          routingKey: "alpha",
          routingDisplayName: "Alpha",
          isDefaultRouting: true,
        },
      ],
      accessMode: "restricted",
    };
  },
  updateIdentityOperatorPersonaAssignments: async (
    userId: string,
    payload: unknown,
  ) => {
    updateOperatorAssignmentsCalls.push({ userId, payload });
    return {
      id: "operator-1",
      personId: "user-operator",
      email: "operator@dotly.one",
      role: "ADMIN",
      status: "ACTIVE",
      assignedPersonaIds: [],
      assignedPersonas: [],
      accessMode: "full",
    };
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
    return {
      connectionId: "connection-1",
      sourceIdentityId: "identity-source",
      targetIdentityId: "identity-target",
      sourceIdentity: {
        id: "identity-source",
        displayName: "Source Identity",
        handle: "source",
        identityType: "personal",
        verificationLevel: "basic",
        status: "active",
      },
      targetIdentity: {
        id: "identity-target",
        displayName: "Target Identity",
        handle: "target",
        identityType: "business",
        verificationLevel: "verified",
        status: "active",
      },
      permissions: {},
    };
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
  getOrCreateDirectConversation: async (payload: unknown) => {
    getOrCreateConversationCalls.push(payload);
    return { conversationId: "conversation-1", ...(payload as object) };
  },
  getConversationById: async (payload: unknown) => {
    getConversationCalls.push(payload);
    return { conversationId: "conversation-1" };
  },
  listAccessibleConversationsForUser: async (payload: unknown) => {
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
      sub: TEST_USER_ID,
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

  it("lists identities for the authenticated user through GET /identities", async () => {
    const headers = await authHeaders();
    const response = await fetch(`${baseUrl}/v1/identities`, { headers });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data[0].displayName, "Grandpa Joe");
    assert.equal(listIdentitiesCalls.length, 1);
    assert.equal(listIdentitiesCalls[0], TEST_USER_ID);
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
    const getBody = await getResponse.json();
    const listBody = await listResponse.json();

    assert.equal(getResponse.status, 200);
    assert.equal(listResponse.status, 200);
    assert.equal(getBody.data.targetIdentity.displayName, "Target Identity");
    assert.equal(listBody.data[0].targetIdentity.handle, "target");
    assert.equal(getConnectionCalls.length, 1);
    assert.equal(listConnectionsCalls.length, 1);
  });

  it("lists team access and updates persona assignments", async () => {
    const headers = await authHeaders();
    const listResponse = await fetch(
      `${baseUrl}/v1/identities/11111111-1111-4111-8111-111111111111/team-access`,
      { headers },
    );
    const updateMemberResponse = await fetch(
      `${baseUrl}/v1/identities/11111111-1111-4111-8111-111111111111/members/22222222-2222-4222-8222-222222222222/persona-assignments`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({
          personaIds: ["33333333-3333-4333-8333-333333333333"],
        }),
      },
    );
    const updateOperatorResponse = await fetch(
      `${baseUrl}/v1/identities/11111111-1111-4111-8111-111111111111/operators/44444444-4444-4444-8444-444444444444/persona-assignments`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({
          personaIds: [],
        }),
      },
    );
    const listBody = await listResponse.json();

    assert.equal(listResponse.status, 200);
    assert.equal(updateMemberResponse.status, 200);
    assert.equal(updateOperatorResponse.status, 200);
    assert.equal(listBody.data.members[0].email, "member@dotly.one");
    assert.equal(listTeamAccessCalls.length, 1);
    assert.deepEqual(listTeamAccessCalls[0], {
      userId: TEST_USER_ID,
      identityId: "11111111-1111-4111-8111-111111111111",
    });
    assert.deepEqual(updateMemberAssignmentsCalls[0], {
      userId: TEST_USER_ID,
      payload: {
        identityId: "11111111-1111-4111-8111-111111111111",
        memberId: "22222222-2222-4222-8222-222222222222",
        personaIds: ["33333333-3333-4333-8333-333333333333"],
      },
    });
    assert.deepEqual(updateOperatorAssignmentsCalls[0], {
      userId: TEST_USER_ID,
      payload: {
        identityId: "11111111-1111-4111-8111-111111111111",
        operatorId: "44444444-4444-4444-8444-444444444444",
        personaIds: [],
      },
    });
  });

  it("manages identity members and operators", async () => {
    const headers = await authHeaders();
    const listMembersResponse = await fetch(
      `${baseUrl}/v1/identities/11111111-1111-4111-8111-111111111111/members`,
      { headers },
    );
    const createMemberResponse = await fetch(
      `${baseUrl}/v1/identities/11111111-1111-4111-8111-111111111111/members`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          personId: "55555555-5555-4555-8555-555555555555",
          role: "MANAGER",
          status: "INVITED",
          personaIds: ["33333333-3333-4333-8333-333333333333"],
        }),
      },
    );
    const updateMemberResponse = await fetch(
      `${baseUrl}/v1/identities/11111111-1111-4111-8111-111111111111/members/22222222-2222-4222-8222-222222222222`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          role: "MANAGER",
          status: "SUSPENDED",
        }),
      },
    );
    const removeMemberResponse = await fetch(
      `${baseUrl}/v1/identities/11111111-1111-4111-8111-111111111111/members/22222222-2222-4222-8222-222222222222`,
      {
        method: "DELETE",
        headers,
      },
    );
    const listOperatorsResponse = await fetch(
      `${baseUrl}/v1/identities/11111111-1111-4111-8111-111111111111/operators`,
      { headers },
    );
    const createOperatorResponse = await fetch(
      `${baseUrl}/v1/identities/11111111-1111-4111-8111-111111111111/operators`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          personId: "66666666-6666-4666-8666-666666666666",
          role: "OPERATOR",
          status: "INVITED",
        }),
      },
    );
    const updateOperatorResponse = await fetch(
      `${baseUrl}/v1/identities/11111111-1111-4111-8111-111111111111/operators/44444444-4444-4444-8444-444444444444`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          role: "OPERATOR",
          status: "ACTIVE",
        }),
      },
    );
    const revokeOperatorResponse = await fetch(
      `${baseUrl}/v1/identities/11111111-1111-4111-8111-111111111111/operators/44444444-4444-4444-8444-444444444444`,
      {
        method: "DELETE",
        headers,
      },
    );

    assert.equal(listMembersResponse.status, 200);
    assert.equal(createMemberResponse.status, 201);
    assert.equal(updateMemberResponse.status, 200);
    assert.equal(removeMemberResponse.status, 200);
    assert.equal(listOperatorsResponse.status, 200);
    assert.equal(createOperatorResponse.status, 201);
    assert.equal(updateOperatorResponse.status, 200);
    assert.equal(revokeOperatorResponse.status, 200);
    assert.deepEqual(listMembersCalls[0], {
      userId: TEST_USER_ID,
      identityId: "11111111-1111-4111-8111-111111111111",
    });
    assert.deepEqual(createMemberCalls[0], {
      userId: TEST_USER_ID,
      payload: {
        identityId: "11111111-1111-4111-8111-111111111111",
        personId: "55555555-5555-4555-8555-555555555555",
        role: "MANAGER",
        status: "INVITED",
        personaIds: ["33333333-3333-4333-8333-333333333333"],
      },
    });
    assert.deepEqual(updateMemberCalls[0], {
      userId: TEST_USER_ID,
      payload: {
        identityId: "11111111-1111-4111-8111-111111111111",
        memberId: "22222222-2222-4222-8222-222222222222",
        role: "MANAGER",
        status: "SUSPENDED",
      },
    });
    assert.deepEqual(removeMemberCalls[0], {
      userId: TEST_USER_ID,
      payload: {
        identityId: "11111111-1111-4111-8111-111111111111",
        memberId: "22222222-2222-4222-8222-222222222222",
      },
    });
    assert.deepEqual(listOperatorsCalls[0], {
      userId: TEST_USER_ID,
      identityId: "11111111-1111-4111-8111-111111111111",
    });
    assert.deepEqual(createOperatorCalls[0], {
      userId: TEST_USER_ID,
      payload: {
        identityId: "11111111-1111-4111-8111-111111111111",
        personId: "66666666-6666-4666-8666-666666666666",
        role: "OPERATOR",
        status: "INVITED",
        personaIds: undefined,
      },
    });
    assert.deepEqual(updateOperatorCalls[0], {
      userId: TEST_USER_ID,
      payload: {
        identityId: "11111111-1111-4111-8111-111111111111",
        operatorId: "44444444-4444-4444-8444-444444444444",
        role: "OPERATOR",
        status: "ACTIVE",
      },
    });
    assert.deepEqual(revokeOperatorCalls[0], {
      userId: TEST_USER_ID,
      payload: {
        identityId: "11111111-1111-4111-8111-111111111111",
        operatorId: "44444444-4444-4444-8444-444444444444",
      },
    });
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
    const resolvedBody = await resolvedResponse.json();

    assert.equal(resolvedResponse.status, 200);
    assert.equal(explainOneResponse.status, 200);
    assert.equal(explainAllResponse.status, 200);
    assert.equal(diffResponse.status, 200);
    assert.equal(
      resolvedBody.data.targetIdentity.displayName,
      "Target Identity",
    );
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
    const getOrCreateResponse = await fetch(
      `${baseUrl}/v1/identity-conversations/get-or-create`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          sourceIdentityId: "11111111-1111-4111-8111-111111111111",
          targetIdentityId: "22222222-2222-4222-8222-222222222222",
          connectionId: "33333333-3333-4333-8333-333333333333",
          conversationType: "DIRECT",
          createdByIdentityId: "11111111-1111-4111-8111-111111111111",
        }),
      },
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
    assert.equal(getOrCreateResponse.status, 201);
    assert.equal(listResponse.status, 200);
    assert.equal(updateResponse.status, 200);
    assert.equal(createConversationCalls.length, 1);
    assert.equal(getOrCreateConversationCalls.length, 1);
    assert.equal(getConversationCalls.length, 1);
    assert.equal(listConversationsCalls.length, 1);
    assert.deepEqual(listConversationsCalls[0], {
      userId: TEST_USER_ID,
      identityId: "11111111-1111-4111-8111-111111111111",
      personaId: undefined,
      status: "ACTIVE",
    });
    assert.equal(updateConversationStatusCalls.length, 1);
    assert.deepEqual(updateConversationStatusCalls[0], {
      conversationId: "11111111-1111-4111-8111-111111111111",
      currentUserId: TEST_USER_ID,
      status: "LOCKED",
    });
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
    assert.deepEqual(enforceActionCalls[0], {
      conversationId: "11111111-1111-4111-8111-111111111111",
      currentUserId: TEST_USER_ID,
      actorIdentityId: "22222222-2222-4222-8222-222222222222",
      actionType: ActionType.SendText,
      contentId: undefined,
      currentViewCount: undefined,
      metadata: undefined,
    });
    assert.deepEqual(enforceCallCalls[0], {
      conversationId: "11111111-1111-4111-8111-111111111111",
      currentUserId: TEST_USER_ID,
      actorIdentityId: "22222222-2222-4222-8222-222222222222",
      callType: CallType.Video,
      initiationMode: CallInitiationMode.Direct,
      screenCaptureDetected: undefined,
      castingDetected: undefined,
      deviceIntegrityCompromised: undefined,
      currentProtectedModeExpectation: undefined,
      metadata: undefined,
    });
    assert.deepEqual(enforceAICalls[0], {
      conversationId: "11111111-1111-4111-8111-111111111111",
      currentUserId: TEST_USER_ID,
      actorIdentityId: "22222222-2222-4222-8222-222222222222",
      capability: AICapability.Summary,
      contextType: AIExecutionContext.Conversation,
      contentId: undefined,
      isProtectedContent: undefined,
      isVaultContent: undefined,
      previewRiskSignals: undefined,
    });
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
