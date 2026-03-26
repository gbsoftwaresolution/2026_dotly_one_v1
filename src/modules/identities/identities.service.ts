import { createHash } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ConnectionStatus as PrismaConnectionStatus,
  ConnectionType as PrismaConnectionType,
  IdentityType as PrismaIdentityType,
  PermissionEffect as PrismaPermissionEffect,
  Prisma,
  RelationshipType as PrismaRelationshipType,
  TrustState as PrismaTrustState,
} from "../../generated/prisma/client";
import type {
  ConnectionPolicyTemplate,
  Identity,
  IdentityConnection,
} from "../../generated/prisma/client";

import { ConnectionStatus } from "../../common/enums/connection-status.enum";
import { ConnectionType } from "../../common/enums/connection-type.enum";
import { IdentityType } from "../../common/enums/identity-type.enum";
import { PermissionEffect } from "../../common/enums/permission-effect.enum";
import { RelationshipType } from "../../common/enums/relationship-type.enum";
import { TrustState } from "../../common/enums/trust-state.enum";
import { PrismaService } from "../../infrastructure/database/prisma.service";

import { CreateConnectionDto } from "./dto/create-connection.dto";
import { CreateConversationDto } from "./dto/create-conversation.dto";
import { CreateIdentityDto } from "./dto/create-identity.dto";
import { BindResolvedPermissionsToConversationDto } from "./dto/bind-resolved-permissions-to-conversation.dto";
import { DeleteContentAccessRuleDto } from "./dto/delete-content-access-rule.dto";
import { GetContentAccessRuleDto } from "./dto/get-content-access-rule.dto";
import { GetConnectionByIdDto } from "./dto/get-connection-by-id.dto";
import { GetConversationByIdDto } from "./dto/get-conversation-by-id.dto";
import { GetConnectionPolicyTemplateDto } from "./dto/get-connection-policy-template.dto";
import { GetOrCreateDirectConversationDto } from "./dto/get-or-create-direct-conversation.dto";
import { GetLatestPermissionSnapshotDto } from "./dto/get-latest-permission-snapshot.dto";
import { ListConnectionsForIdentityDto } from "./dto/list-connections-for-identity.dto";
import { ListConversationsForIdentityDto } from "./dto/list-conversations-for-identity.dto";
import { ListContentAccessRulesForContentDto } from "./dto/list-content-access-rules-for-content.dto";
import { ListPermissionOverridesForConnectionDto } from "./dto/list-permission-overrides-for-connection.dto";
import { PreviewContentPermissionsDto } from "./dto/preview-content-permissions.dto";
import { PreviewPermissionsWithIdentityBehaviorDto } from "./dto/preview-permissions-with-identity-behavior.dto";
import { PreviewPermissionsWithRelationshipDto } from "./dto/preview-permissions-with-relationship.dto";
import { PreviewPermissionsWithRiskDto } from "./dto/preview-permissions-with-risk.dto";
import { PreviewPermissionsWithTrustStateDto } from "./dto/preview-permissions-with-trust-state.dto";
import { PreviewResolvedPermissionsForConnectionDto } from "./dto/preview-resolved-permissions-for-connection.dto";
import { ResolveConnectionPermissionsDto } from "./dto/resolve-connection-permissions.dto";
import { ResolveConversationContextDto } from "./dto/resolve-conversation-context.dto";
import { ResolveContentPermissionsForConnectionDto } from "./dto/resolve-content-permissions-for-connection.dto";
import { SetContentAccessRuleDto } from "./dto/set-content-access-rule.dto";
import { SetPermissionOverrideDto } from "./dto/set-permission-override.dto";
import { UpdateConversationStatusDto } from "./dto/update-conversation-status.dto";
import { UpdateConnectionStatusDto } from "./dto/update-connection-status.dto";
import { UpdateConnectionRelationshipTypeDto } from "./dto/update-connection-relationship-type.dto";
import { UpdateConnectionTypeDto } from "./dto/update-connection-type.dto";
import { UpdateTrustStateDto } from "./dto/update-trust-state.dto";
import type {
  BoundConversationPermissions,
  CachedConversationContext,
  CachedResolvedConnectionPermissions,
  ConversationBindingStalenessResult,
  ConversationPermissionBindingSummary,
  ConversationResolutionTrace,
  ConnectionPermissionOverrideRecord,
  ConnectionPermissionResolutionSummary,
  ConnectionPermissionSnapshotRecord,
  ConnectionPolicyTemplateLimits,
  ConnectionPolicyTemplatePermissions,
  ConnectionPolicyTemplateRecord,
  ConnectionPolicyTemplateSeedDefinition,
  ContentAccessRuleValue,
  PreviewPermissionsWithIdentityBehaviorResult,
  PreviewPermissionsWithRelationshipResult,
  IdentityConversationContext,
  ManualOverrideMap,
  PreviewContentPermissionsResult,
  PreviewPermissionsWithRiskResult,
  PreviewPermissionsWithTrustStateResult,
  PreviewResolvedPermissionsForConnectionResult,
  PermissionMergeTrace,
  PermissionSnapshotMetadata,
  SnapshotFreshnessCheckResult,
  ResolveConversationContextResult,
  ResolvedContentPermissionsForConnectionResult,
  ResolvedConnectionPermissions,
  ResolvedPermissionMap,
  TrustStateAdjustmentDefinition,
} from "./identity.types";
import {
  ConversationStatus,
  ConversationType,
  RecordPolicy,
  ScreenshotPolicy,
} from "./identity.types";
import {
  deriveContentPermissionSubset,
  deriveContentPermissionSubsetFromFinalPermissions,
} from "./content-permission-mapping";
import { applyContentAccessRule } from "./content-permission-merge";
import { applyManualOverrides } from "./manual-override-merge";
import {
  applyTrustStateAdjustment,
  getTrustStateAdjustment as getTrustStateAdjustmentDefinition,
} from "./permission-merge";
import {
  applyRiskOverlay,
  createEmptyRiskSummary,
  deriveRiskSignalsFromTrustState,
  type RiskSignalRecord,
} from "./risk-engine";
import { getIdentityTypeBehavior as resolveIdentityTypeBehavior } from "./identity-type-behaviors";
import { applyIdentityTypeBehavior } from "./identity-behavior-merge";
import {
  getRelationshipBehavior as resolveRelationshipBehavior,
  inferRelationshipTypeFromConnectionType,
  summarizeRelationshipBehavior,
} from "./relationship-engine";
import { applyRelationshipBehavior } from "./relationship-merge";
import {
  CONNECTION_POLICY_TEMPLATE_SEEDS,
  validateTemplatePermissions,
} from "./policy-template-seeds";
import {
  createConnectionPermissionCacheKey,
  createConversationContextCacheKey,
  PERMISSION_RESOLVER_VERSION,
  PermissionCacheStore,
} from "./permission-cache";
import { PERMISSION_KEYS, type PermissionKey } from "./permission-keys";

const identityConnectionSelect = {
  id: true,
  sourceIdentityId: true,
  targetIdentityId: true,
  connectionType: true,
  relationshipType: true,
  trustState: true,
  status: true,
  createdByIdentityId: true,
  note: true,
  metadataJson: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.IdentityConnectionSelect;

const contentAccessRuleSelect = {
  id: true,
  contentId: true,
  targetIdentityId: true,
  canView: true,
  canDownload: true,
  canForward: true,
  canExport: true,
  screenshotPolicy: true,
  recordPolicy: true,
  expiryAt: true,
  viewLimit: true,
  watermarkMode: true,
  aiAccessAllowed: true,
  metadataJson: true,
  createdByIdentityId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ContentAccessRuleSelect;

const identityConversationSelect = {
  id: true,
  sourceIdentityId: true,
  targetIdentityId: true,
  connectionId: true,
  conversationType: true,
  status: true,
  title: true,
  metadataJson: true,
  lastResolvedAt: true,
  lastPermissionHash: true,
  createdByIdentityId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.IdentityConversationSelect;

type IdentityConnectionRecord = Prisma.IdentityConnectionGetPayload<{
  select: typeof identityConnectionSelect;
}>;

type ContentAccessRuleRecord = Prisma.ContentAccessRuleGetPayload<{
  select: typeof contentAccessRuleSelect;
}>;

type IdentityConversationRecord = Prisma.IdentityConversationGetPayload<{
  select: typeof identityConversationSelect;
}>;

@Injectable()
export class IdentitiesService {
  private readonly permissionCache = new PermissionCacheStore();

  private readonly conversationContextCache = new PermissionCacheStore();

  constructor(private readonly prismaService: PrismaService) {}

  async createIdentity(
    createIdentityDto: CreateIdentityDto,
  ): Promise<Identity> {
    try {
      return await this.prismaService.identity.create({
        data: {
          personId: createIdentityDto.personId ?? null,
          identityType: toPrismaIdentityType(createIdentityDto.identityType),
          displayName: createIdentityDto.displayName,
          handle: createIdentityDto.handle ?? null,
          verificationLevel: createIdentityDto.verificationLevel,
          status: createIdentityDto.status,
          metadataJson: toNullableJsonInput(createIdentityDto.metadataJson),
        },
      });
    } catch (error) {
      throw this.mapKnownError(error, "Identity handle already in use");
    }
  }

  async createConnection(
    createConnectionDto: CreateConnectionDto,
  ): Promise<IdentityConnectionRecord> {
    this.assertNotSelfConnection(
      createConnectionDto.sourceIdentityId,
      createConnectionDto.targetIdentityId,
    );

    const normalizedStatus = this.normalizeStatusForConnection(
      createConnectionDto.connectionType,
      createConnectionDto.trustState,
      createConnectionDto.status,
    );

    try {
      return await this.prismaService.identityConnection.create({
        data: {
          sourceIdentityId: createConnectionDto.sourceIdentityId,
          targetIdentityId: createConnectionDto.targetIdentityId,
          connectionType: toPrismaConnectionType(
            createConnectionDto.connectionType,
          ),
          relationshipType: toNullablePrismaRelationshipType(
            createConnectionDto.relationshipType ??
              inferRelationshipTypeFromConnectionType(
                createConnectionDto.connectionType,
              ),
          ),
          trustState: toPrismaTrustState(createConnectionDto.trustState),
          status: toPrismaConnectionStatus(normalizedStatus),
          createdByIdentityId: createConnectionDto.createdByIdentityId,
          note: createConnectionDto.note ?? null,
          metadataJson: toNullableJsonInput(createConnectionDto.metadataJson),
        },
        select: identityConnectionSelect,
      });
    } catch (error) {
      throw this.mapKnownError(error, "Identity connection already exists");
    }
  }

  async updateConnectionType(
    updateConnectionTypeDto: UpdateConnectionTypeDto,
  ): Promise<IdentityConnectionRecord> {
    const existingConnection = await this.requireConnection(
      updateConnectionTypeDto.connectionId,
    );
    const nextStatus = this.normalizeStatusForConnection(
      updateConnectionTypeDto.connectionType,
      toApiTrustState(existingConnection.trustState),
      toApiConnectionStatus(existingConnection.status),
    );

    const updatedConnection =
      await this.prismaService.identityConnection.update({
        where: {
          id: updateConnectionTypeDto.connectionId,
        },
        data: {
          connectionType: toPrismaConnectionType(
            updateConnectionTypeDto.connectionType,
          ),
          relationshipType:
            existingConnection.relationshipType ??
            toPrismaRelationshipType(
              inferRelationshipTypeFromConnectionType(
                updateConnectionTypeDto.connectionType,
              ),
            ),
          status: toPrismaConnectionStatus(nextStatus),
        },
        select: identityConnectionSelect,
      });

    await this.invalidateCachesForConnection(
      updateConnectionTypeDto.connectionId,
    );
    return updatedConnection;
  }

  async updateConnectionRelationshipType(
    updateConnectionRelationshipTypeDto: UpdateConnectionRelationshipTypeDto,
  ): Promise<IdentityConnectionRecord> {
    await this.requireConnection(
      updateConnectionRelationshipTypeDto.connectionId,
    );

    const updatedConnection =
      await this.prismaService.identityConnection.update({
        where: {
          id: updateConnectionRelationshipTypeDto.connectionId,
        },
        data: {
          relationshipType: toPrismaRelationshipType(
            updateConnectionRelationshipTypeDto.relationshipType,
          ),
        },
        select: identityConnectionSelect,
      });

    await this.invalidateCachesForConnection(
      updateConnectionRelationshipTypeDto.connectionId,
    );
    return updatedConnection;
  }

  async updateTrustState(
    updateTrustStateDto: UpdateTrustStateDto,
  ): Promise<IdentityConnectionRecord> {
    const existingConnection = await this.requireConnection(
      updateTrustStateDto.connectionId,
    );
    const nextStatus = this.normalizeStatusForConnection(
      toApiConnectionType(existingConnection.connectionType),
      updateTrustStateDto.trustState,
      toApiConnectionStatus(existingConnection.status),
    );

    const updatedConnection =
      await this.prismaService.identityConnection.update({
        where: {
          id: updateTrustStateDto.connectionId,
        },
        data: {
          trustState: toPrismaTrustState(updateTrustStateDto.trustState),
          status: toPrismaConnectionStatus(nextStatus),
        },
        select: identityConnectionSelect,
      });

    await this.invalidateCachesForConnection(updateTrustStateDto.connectionId);
    return updatedConnection;
  }

  async updateConnectionStatus(
    updateConnectionStatusDto: UpdateConnectionStatusDto,
  ): Promise<IdentityConnectionRecord> {
    const existingConnection = await this.requireConnection(
      updateConnectionStatusDto.connectionId,
    );
    const nextStatus = this.normalizeStatusForConnection(
      toApiConnectionType(existingConnection.connectionType),
      toApiTrustState(existingConnection.trustState),
      updateConnectionStatusDto.status,
    );

    return this.prismaService.identityConnection.update({
      where: {
        id: updateConnectionStatusDto.connectionId,
      },
      data: {
        status: toPrismaConnectionStatus(nextStatus),
      },
      select: identityConnectionSelect,
    });
  }

  async setPermissionOverride(
    setPermissionOverrideDto: SetPermissionOverrideDto,
  ) {
    await this.requireConnection(setPermissionOverrideDto.connectionId);

    const override =
      await this.prismaService.connectionPermissionOverride.upsert({
        where: {
          connectionId_permissionKey: {
            connectionId: setPermissionOverrideDto.connectionId,
            permissionKey: setPermissionOverrideDto.permissionKey,
          },
        },
        update: {
          effect: toPrismaPermissionEffect(setPermissionOverrideDto.effect),
          limitsJson: toNullableJsonInput(setPermissionOverrideDto.limitsJson),
          reason: setPermissionOverrideDto.reason ?? null,
          createdByIdentityId: setPermissionOverrideDto.createdByIdentityId,
          createdAt: new Date(),
        },
        create: {
          connectionId: setPermissionOverrideDto.connectionId,
          permissionKey: setPermissionOverrideDto.permissionKey,
          effect: toPrismaPermissionEffect(setPermissionOverrideDto.effect),
          limitsJson: toNullableJsonInput(setPermissionOverrideDto.limitsJson),
          reason: setPermissionOverrideDto.reason ?? null,
          createdByIdentityId: setPermissionOverrideDto.createdByIdentityId,
        },
      });

    await this.invalidateCachesForConnection(
      setPermissionOverrideDto.connectionId,
    );
    return override;
  }

  async setContentAccessRule(
    setContentAccessRuleDto: SetContentAccessRuleDto,
  ): Promise<ContentAccessRuleValue> {
    const contentRule = await this.prismaService.contentAccessRule.upsert({
      where: {
        contentId_targetIdentityId: {
          contentId: setContentAccessRuleDto.contentId,
          targetIdentityId: setContentAccessRuleDto.targetIdentityId,
        },
      },
      update: {
        canView: setContentAccessRuleDto.canView ?? false,
        canDownload: setContentAccessRuleDto.canDownload ?? false,
        canForward: setContentAccessRuleDto.canForward ?? false,
        canExport: setContentAccessRuleDto.canExport ?? false,
        screenshotPolicy:
          setContentAccessRuleDto.screenshotPolicy ?? ScreenshotPolicy.Inherit,
        recordPolicy:
          setContentAccessRuleDto.recordPolicy ?? RecordPolicy.Inherit,
        expiryAt: setContentAccessRuleDto.expiryAt
          ? new Date(setContentAccessRuleDto.expiryAt)
          : null,
        viewLimit: setContentAccessRuleDto.viewLimit ?? null,
        watermarkMode: setContentAccessRuleDto.watermarkMode ?? null,
        aiAccessAllowed: setContentAccessRuleDto.aiAccessAllowed ?? null,
        metadataJson: toNullableJsonInput(setContentAccessRuleDto.metadataJson),
        createdByIdentityId: setContentAccessRuleDto.createdByIdentityId,
      },
      create: {
        contentId: setContentAccessRuleDto.contentId,
        targetIdentityId: setContentAccessRuleDto.targetIdentityId,
        canView: setContentAccessRuleDto.canView ?? false,
        canDownload: setContentAccessRuleDto.canDownload ?? false,
        canForward: setContentAccessRuleDto.canForward ?? false,
        canExport: setContentAccessRuleDto.canExport ?? false,
        screenshotPolicy:
          setContentAccessRuleDto.screenshotPolicy ?? ScreenshotPolicy.Inherit,
        recordPolicy:
          setContentAccessRuleDto.recordPolicy ?? RecordPolicy.Inherit,
        expiryAt: setContentAccessRuleDto.expiryAt
          ? new Date(setContentAccessRuleDto.expiryAt)
          : null,
        viewLimit: setContentAccessRuleDto.viewLimit ?? null,
        watermarkMode: setContentAccessRuleDto.watermarkMode ?? null,
        aiAccessAllowed: setContentAccessRuleDto.aiAccessAllowed ?? null,
        metadataJson: toNullableJsonInput(setContentAccessRuleDto.metadataJson),
        createdByIdentityId: setContentAccessRuleDto.createdByIdentityId,
      },
      select: contentAccessRuleSelect,
    });

    return toContentAccessRuleValue(contentRule);
  }

  async createConversation(
    createConversationDto: CreateConversationDto,
  ): Promise<IdentityConversationContext> {
    const connection = await this.requireConnection(
      createConversationDto.connectionId,
    );

    this.assertConversationMatchesConnection(createConversationDto, connection);

    const resolvedPermissions = await this.resolveConnectionPermissions({
      connectionId: createConversationDto.connectionId,
      persistSnapshot: false,
    });
    const sourceIdentity = await this.requireIdentity(
      createConversationDto.sourceIdentityId,
    );
    const targetIdentity = await this.requireIdentity(
      createConversationDto.targetIdentityId,
    );
    const sourceIdentityType = toApiIdentityType(sourceIdentity.identityType);
    const targetIdentityType = toApiIdentityType(targetIdentity.identityType);

    if (!sourceIdentityType || !targetIdentityType) {
      throw new BadRequestException(
        "Conversation requires valid source and target identity types",
      );
    }

    this.assertConversationTypeCompatibility(
      createConversationDto.conversationType,
      resolvedPermissions,
      sourceIdentityType,
      targetIdentityType,
    );

    try {
      const conversation = await this.prismaService.identityConversation.create(
        {
          data: {
            sourceIdentityId: createConversationDto.sourceIdentityId,
            targetIdentityId: createConversationDto.targetIdentityId,
            connectionId: createConversationDto.connectionId,
            conversationType: createConversationDto.conversationType,
            status: createConversationDto.status ?? ConversationStatus.Active,
            title: createConversationDto.title ?? null,
            metadataJson: toNullableJsonInput(
              createConversationDto.metadataJson,
            ),
            createdByIdentityId: createConversationDto.createdByIdentityId,
          },
          select: identityConversationSelect,
        },
      );

      return toIdentityConversationContext(conversation);
    } catch (error) {
      throw this.mapKnownError(error, "Identity conversation already exists");
    }
  }

  async getConversationById(
    getConversationByIdDto: GetConversationByIdDto,
  ): Promise<IdentityConversationContext> {
    return toIdentityConversationContext(
      await this.requireConversation(getConversationByIdDto.conversationId),
    );
  }

  async listConversationsForIdentity(
    listConversationsForIdentityDto: ListConversationsForIdentityDto,
  ): Promise<IdentityConversationContext[]> {
    const conversations =
      await this.prismaService.identityConversation.findMany({
        where: {
          OR: [
            {
              sourceIdentityId: listConversationsForIdentityDto.identityId,
            },
            {
              targetIdentityId: listConversationsForIdentityDto.identityId,
            },
          ],
          ...(listConversationsForIdentityDto.status
            ? {
                status: listConversationsForIdentityDto.status,
              }
            : {}),
        },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        select: identityConversationSelect,
      });

    return conversations.map(toIdentityConversationContext);
  }

  async updateConversationStatus(
    updateConversationStatusDto: UpdateConversationStatusDto,
  ): Promise<IdentityConversationContext> {
    const conversation = await this.prismaService.identityConversation.update({
      where: {
        id: updateConversationStatusDto.conversationId,
      },
      data: {
        status: updateConversationStatusDto.status,
      },
      select: identityConversationSelect,
    });

    return toIdentityConversationContext(conversation);
  }

  async getOrCreateDirectConversation(
    getOrCreateDirectConversationDto: GetOrCreateDirectConversationDto,
  ): Promise<IdentityConversationContext> {
    const existingConversation =
      await this.prismaService.identityConversation.findUnique({
        where: {
          sourceIdentityId_targetIdentityId_connectionId: {
            sourceIdentityId: getOrCreateDirectConversationDto.sourceIdentityId,
            targetIdentityId: getOrCreateDirectConversationDto.targetIdentityId,
            connectionId: getOrCreateDirectConversationDto.connectionId,
          },
        },
        select: identityConversationSelect,
      });

    if (existingConversation) {
      return toIdentityConversationContext(existingConversation);
    }

    return this.createConversation({
      sourceIdentityId: getOrCreateDirectConversationDto.sourceIdentityId,
      targetIdentityId: getOrCreateDirectConversationDto.targetIdentityId,
      connectionId: getOrCreateDirectConversationDto.connectionId,
      conversationType: getOrCreateDirectConversationDto.conversationType,
      createdByIdentityId: getOrCreateDirectConversationDto.createdByIdentityId,
      status: ConversationStatus.Active,
    });
  }

  async getContentAccessRule(
    getContentAccessRuleDto: GetContentAccessRuleDto,
  ): Promise<ContentAccessRuleValue | null> {
    const contentRule = await this.prismaService.contentAccessRule.findUnique({
      where: {
        contentId_targetIdentityId: {
          contentId: getContentAccessRuleDto.contentId,
          targetIdentityId: getContentAccessRuleDto.targetIdentityId,
        },
      },
      select: contentAccessRuleSelect,
    });

    return contentRule ? toContentAccessRuleValue(contentRule) : null;
  }

  async deleteContentAccessRule(
    deleteContentAccessRuleDto: DeleteContentAccessRuleDto,
  ): Promise<void> {
    await this.prismaService.contentAccessRule.deleteMany({
      where: {
        contentId: deleteContentAccessRuleDto.contentId,
        targetIdentityId: deleteContentAccessRuleDto.targetIdentityId,
      },
    });
  }

  async listContentAccessRulesForContent(
    listContentAccessRulesForContentDto: ListContentAccessRulesForContentDto,
  ): Promise<ContentAccessRuleValue[]> {
    const contentRules = await this.prismaService.contentAccessRule.findMany({
      where: {
        contentId: listContentAccessRulesForContentDto.contentId,
      },
      orderBy: [{ targetIdentityId: "asc" }, { createdAt: "asc" }],
      select: contentAccessRuleSelect,
    });

    return contentRules.map(toContentAccessRuleValue);
  }

  async getIdentityTypeForIdentity(identityId: string): Promise<IdentityType> {
    const identity = await this.requireIdentity(identityId);
    const identityType = toApiIdentityType(identity.identityType);

    if (!identityType) {
      throw new NotFoundException("Identity type not found");
    }

    return identityType;
  }

  async getRelationshipTypeForConnection(
    connectionId: string,
  ): Promise<RelationshipType> {
    const connection = await this.requireConnection(connectionId);

    return toConnectionRelationshipType(connection);
  }

  async getConnectionById(
    getConnectionByIdDto: GetConnectionByIdDto,
  ): Promise<IdentityConnectionRecord> {
    return this.requireConnection(getConnectionByIdDto.connectionId);
  }

  async listConnectionsForIdentity(
    listConnectionsForIdentityDto: ListConnectionsForIdentityDto,
  ): Promise<IdentityConnectionRecord[]> {
    return this.prismaService.identityConnection.findMany({
      where: {
        OR: [
          {
            sourceIdentityId: listConnectionsForIdentityDto.identityId,
          },
          {
            targetIdentityId: listConnectionsForIdentityDto.identityId,
          },
        ],
        ...(listConnectionsForIdentityDto.status
          ? {
              status: toPrismaConnectionStatus(
                listConnectionsForIdentityDto.status,
              ),
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      select: identityConnectionSelect,
    });
  }

  async seedConnectionPolicyTemplates(): Promise<ConnectionPolicyTemplate[]> {
    const seededTemplates: ConnectionPolicyTemplate[] = [];

    for (const templateDefinition of CONNECTION_POLICY_TEMPLATE_SEEDS) {
      validateTemplatePermissions(templateDefinition.permissions);
      const upsertPayload = buildTemplateUpsertPayload(templateDefinition);
      const seededTemplate =
        await this.prismaService.connectionPolicyTemplate.upsert({
          where: {
            templateKey: templateDefinition.templateKey,
          },
          update: {
            sourceIdentityType: upsertPayload.sourceIdentityType,
            connectionType: upsertPayload.connectionType,
            displayName: upsertPayload.displayName,
            description: upsertPayload.description,
            policyVersion: upsertPayload.policyVersion,
            permissionsJson: upsertPayload.permissionsJson,
            limitsJson: upsertPayload.limitsJson,
            isSystem: upsertPayload.isSystem,
            isActive: upsertPayload.isActive,
          },
          create: upsertPayload,
        });

      seededTemplates.push(seededTemplate);
    }

    return seededTemplates;
  }

  async getConnectionPolicyTemplate(
    getConnectionPolicyTemplateDto: GetConnectionPolicyTemplateDto,
  ): Promise<ConnectionPolicyTemplateRecord> {
    let template = null;

    if (getConnectionPolicyTemplateDto.sourceIdentityType) {
      template = await this.prismaService.connectionPolicyTemplate.findFirst({
        where: {
          sourceIdentityType: toPrismaIdentityType(
            getConnectionPolicyTemplateDto.sourceIdentityType,
          ),
          connectionType: toPrismaConnectionType(
            getConnectionPolicyTemplateDto.connectionType,
          ),
          isActive: true,
        },
      });
    }

    if (!template) {
      template = await this.prismaService.connectionPolicyTemplate.findFirst({
        where: {
          sourceIdentityType: null,
          connectionType: toPrismaConnectionType(
            getConnectionPolicyTemplateDto.connectionType,
          ),
          isActive: true,
        },
      });
    }

    if (!template) {
      throw new NotFoundException("Connection policy template not found");
    }

    return toConnectionPolicyTemplateRecord(template);
  }

  getTrustStateAdjustment(
    trustState: TrustState,
  ): TrustStateAdjustmentDefinition {
    return getTrustStateAdjustmentDefinition(trustState);
  }

  getIdentityTypeBehavior(
    sourceIdentityType: IdentityType,
    targetIdentityType?: IdentityType | null,
  ) {
    return resolveIdentityTypeBehavior(sourceIdentityType, targetIdentityType);
  }

  getRelationshipBehavior(relationshipType: RelationshipType | null) {
    return {
      definition: resolveRelationshipBehavior(relationshipType),
      summary: summarizeRelationshipBehavior(relationshipType),
    };
  }

  invalidateConnectionPermissionCache(connectionId: string) {
    this.permissionCache.delete(
      createConnectionPermissionCacheKey(connectionId),
    );
  }

  invalidateConversationContextCache(conversationId: string) {
    this.conversationContextCache.delete(
      createConversationContextCacheKey(conversationId),
    );
  }

  async invalidateCachesForConnection(connectionId: string) {
    this.invalidateConnectionPermissionCache(connectionId);

    if (!this.prismaService.identityConversation?.findMany) {
      return;
    }

    const conversations =
      await this.prismaService.identityConversation.findMany({
        where: {
          connectionId,
        },
        select: {
          id: true,
        },
      });

    for (const conversation of conversations) {
      this.invalidateConversationContextCache(conversation.id);
    }
  }

  async previewPermissionsWithTrustState(
    previewDto: PreviewPermissionsWithTrustStateDto,
  ): Promise<PreviewPermissionsWithTrustStateResult> {
    const template = await this.getConnectionPolicyTemplate({
      sourceIdentityType: previewDto.sourceIdentityType ?? null,
      connectionType: previewDto.connectionType,
    });
    const trustAdjustedPermissions = applyTrustStateAdjustment(
      template.permissionsJson,
      previewDto.trustState,
    );

    return {
      template: {
        id: template.id,
        sourceIdentityType: template.sourceIdentityType,
        connectionType: template.connectionType,
        templateKey: template.templateKey,
        displayName: template.displayName,
        description: template.description,
        policyVersion: template.policyVersion,
      },
      trustState: previewDto.trustState,
      mergedPermissions: trustAdjustedPermissions.mergedPermissions,
      mergeTrace: trustAdjustedPermissions.mergeTrace,
    };
  }

  async previewPermissionsWithIdentityBehavior(
    previewDto: PreviewPermissionsWithIdentityBehaviorDto,
  ): Promise<PreviewPermissionsWithIdentityBehaviorResult> {
    const template = await this.getConnectionPolicyTemplate({
      sourceIdentityType: previewDto.sourceIdentityType,
      connectionType: previewDto.connectionType,
    });
    const behaviorAdjustedPermissions = applyIdentityTypeBehavior(
      template.permissionsJson,
      previewDto.sourceIdentityType,
      previewDto.targetIdentityType ?? null,
    );
    const trustAdjustedPermissions = applyTrustStateAdjustment(
      behaviorAdjustedPermissions.mergedPermissions,
      previewDto.trustState,
    );
    const mergedTrace = mergeBehaviorTraceWithTrustTrace(
      behaviorAdjustedPermissions.mergeTrace,
      trustAdjustedPermissions.mergeTrace,
    );

    return {
      template: {
        id: template.id,
        sourceIdentityType: template.sourceIdentityType,
        connectionType: template.connectionType,
        templateKey: template.templateKey,
        displayName: template.displayName,
        description: template.description,
        policyVersion: template.policyVersion,
      },
      sourceIdentityType: previewDto.sourceIdentityType,
      targetIdentityType: previewDto.targetIdentityType ?? null,
      connectionType: previewDto.connectionType,
      trustState: previewDto.trustState,
      behaviorSummary: behaviorAdjustedPermissions.behaviorSummary,
      postIdentityBehaviorPermissions:
        behaviorAdjustedPermissions.mergedPermissions,
      finalPermissions: trustAdjustedPermissions.mergedPermissions,
      mergeTrace: mergedTrace,
    };
  }

  async previewPermissionsWithRelationship(
    previewDto: PreviewPermissionsWithRelationshipDto,
  ): Promise<PreviewPermissionsWithRelationshipResult> {
    const template = await this.getConnectionPolicyTemplate({
      sourceIdentityType: previewDto.sourceIdentityType,
      connectionType: previewDto.connectionType,
    });
    const behaviorAdjustedPermissions = applyIdentityTypeBehavior(
      template.permissionsJson,
      previewDto.sourceIdentityType,
      previewDto.targetIdentityType ?? null,
    );
    const relationshipAdjustedPermissions = applyRelationshipBehavior(
      behaviorAdjustedPermissions.mergedPermissions,
      previewDto.relationshipType,
    );
    const trustAdjustedPermissions = applyTrustStateAdjustment(
      relationshipAdjustedPermissions.mergedPermissions,
      previewDto.trustState,
    );
    const mergedTrace = mergeRelationshipTraceWithTrustTrace(
      mergeBehaviorTraceWithRelationshipTrace(
        behaviorAdjustedPermissions.mergeTrace,
        relationshipAdjustedPermissions.relationshipTrace,
      ),
      trustAdjustedPermissions.mergeTrace,
    );

    return {
      template: {
        id: template.id,
        sourceIdentityType: template.sourceIdentityType,
        connectionType: template.connectionType,
        templateKey: template.templateKey,
        displayName: template.displayName,
        description: template.description,
        policyVersion: template.policyVersion,
      },
      sourceIdentityType: previewDto.sourceIdentityType,
      targetIdentityType: previewDto.targetIdentityType ?? null,
      connectionType: previewDto.connectionType,
      trustState: previewDto.trustState,
      relationshipType: previewDto.relationshipType,
      identityBehaviorSummary: behaviorAdjustedPermissions.behaviorSummary,
      relationshipBehaviorSummary:
        relationshipAdjustedPermissions.relationshipSummary,
      postIdentityBehaviorPermissions:
        behaviorAdjustedPermissions.mergedPermissions,
      postRelationshipBehaviorPermissions:
        relationshipAdjustedPermissions.mergedPermissions,
      finalPermissions: trustAdjustedPermissions.mergedPermissions,
      mergeTrace: mergedTrace,
    };
  }

  async listPermissionOverridesForConnection(
    listOverridesDto: ListPermissionOverridesForConnectionDto,
  ): Promise<ConnectionPermissionOverrideRecord[]> {
    const overrides =
      await this.prismaService.connectionPermissionOverride.findMany({
        where: {
          connectionId: listOverridesDto.connectionId,
        },
        orderBy: [{ permissionKey: "asc" }, { createdAt: "asc" }],
      });

    return overrides
      .map(mapConnectionPermissionOverrideRecord)
      .sort((left, right) => {
        const permissionKeyComparison = left.permissionKey.localeCompare(
          right.permissionKey,
        );

        if (permissionKeyComparison !== 0) {
          return permissionKeyComparison;
        }

        return left.createdAt.getTime() - right.createdAt.getTime();
      });
  }

  async previewResolvedPermissionsForConnection(
    previewDto: PreviewResolvedPermissionsForConnectionDto,
  ): Promise<PreviewResolvedPermissionsForConnectionResult> {
    const resolvedPermissions = await this.resolveConnectionPermissions({
      connectionId: previewDto.connectionId,
      persistSnapshot: false,
    });

    return {
      connection: {
        id: resolvedPermissions.connectionId,
        sourceIdentityId: resolvedPermissions.sourceIdentityId,
        targetIdentityId: resolvedPermissions.targetIdentityId,
        relationshipType: resolvedPermissions.relationshipType,
        connectionType: resolvedPermissions.connectionType,
        trustState: resolvedPermissions.trustState,
        status: resolvedPermissions.status,
      },
      template: {
        id: `${resolvedPermissions.connectionId}:${resolvedPermissions.template.templateKey}`,
        sourceIdentityType: resolvedPermissions.sourceIdentityType,
        connectionType: resolvedPermissions.connectionType,
        templateKey: resolvedPermissions.template.templateKey,
        displayName: resolvedPermissions.template.templateKey,
        description: null,
        policyVersion: resolvedPermissions.template.policyVersion,
      },
      trustState: resolvedPermissions.trustState,
      overrides: {
        count: resolvedPermissions.overridesSummary.count,
        items: await this.listPermissionOverridesForConnection({
          connectionId: previewDto.connectionId,
        }),
      },
      finalPermissions: toConnectionPolicyTemplatePermissions(
        resolvedPermissions.permissions,
      ),
      mergeTrace: resolvedPermissions.trace,
    };
  }

  async resolveConnectionPermissions(
    resolveInput: string | ResolveConnectionPermissionsDto,
  ): Promise<ResolvedConnectionPermissions> {
    const resolveDto = normalizeResolveConnectionPermissionsInput(resolveInput);
    const preferCache = resolveDto.preferCache ?? true;
    const preferSnapshot = resolveDto.preferSnapshot ?? false;
    const forceRefresh = resolveDto.forceRefresh ?? false;
    const hasEphemeralPreviewInputs =
      (resolveDto.previewRiskSignals?.length ?? 0) > 0;

    if (!forceRefresh && preferCache && !hasEphemeralPreviewInputs) {
      const cached = await this.getFreshCachedResolvedPermissions(
        resolveDto.connectionId,
        {
          applyRiskOverlay: resolveDto.applyRiskOverlay,
          previewRiskSignals: resolveDto.previewRiskSignals,
        },
      );

      if (cached) {
        return cached.resolved;
      }
    }

    if (!forceRefresh && preferSnapshot && !hasEphemeralPreviewInputs) {
      const snapshot = await this.getLatestPermissionSnapshot({
        connectionId: resolveDto.connectionId,
      });
      const freshness = await this.isSnapshotFresh(
        resolveDto.connectionId,
        snapshot,
        {
          applyRiskOverlay: resolveDto.applyRiskOverlay,
          previewRiskSignals: resolveDto.previewRiskSignals,
        },
      );

      if (snapshot && freshness.fresh && snapshot.metadataJson) {
        const hydrated = await this.hydrateResolvedPermissionsFromSnapshot(
          resolveDto.connectionId,
          snapshot,
          {
            applyRiskOverlay: resolveDto.applyRiskOverlay,
            previewRiskSignals: resolveDto.previewRiskSignals,
          },
        );

        if (hydrated) {
          return hydrated;
        }
      }
    }

    const resolutionCore = await this.resolveConnectionPermissionsCore(
      resolveDto.connectionId,
      {
        applyRiskOverlay: resolveDto.applyRiskOverlay,
        previewRiskSignals: resolveDto.previewRiskSignals,
      },
    );

    if (!hasEphemeralPreviewInputs) {
      await this.storeResolvedPermissionsInCache(
        resolveDto.connectionId,
        resolutionCore,
        {
          applyRiskOverlay: resolveDto.applyRiskOverlay,
          previewRiskSignals: resolveDto.previewRiskSignals,
        },
      );
    }

    if (resolveDto.persistSnapshot === true) {
      await this.persistResolvedPermissionSnapshot(
        resolveDto.connectionId,
        resolutionCore,
      );
    }

    return resolutionCore;
  }

  async previewPermissionsWithRisk(
    previewDto: PreviewPermissionsWithRiskDto,
  ): Promise<PreviewPermissionsWithRiskResult> {
    const template = await this.getConnectionPolicyTemplate({
      sourceIdentityType: previewDto.sourceIdentityType ?? null,
      connectionType: previewDto.connectionType,
    });
    const trustAdjustedPermissions = applyTrustStateAdjustment(
      template.permissionsJson,
      previewDto.trustState,
    );
    const overridesByPermissionKey = mapManualOverridesFromPreview(
      previewDto.manualOverrides,
    );
    const overrideAdjustedPermissions =
      this.applyOverridePreviewToPermissionSet(
        trustAdjustedPermissions.mergedPermissions,
        overridesByPermissionKey,
        {
          trustState: previewDto.trustState,
          templateKey: template.templateKey,
          mergeTrace: trustAdjustedPermissions.mergeTrace,
        },
      );
    const mergedRiskSignals = mergeRiskSignals(
      deriveRiskSignalsFromTrustState(previewDto.trustState),
      previewDto.previewRiskSignals ?? [],
    );
    const riskAdjustedPermissions =
      previewDto.applyRiskOverlay === false
        ? {
            mergedPermissions: overrideAdjustedPermissions.mergedPermissions,
            mergeTrace: overrideAdjustedPermissions.mergeTrace,
            riskSummary: createEmptyRiskSummary(),
          }
        : applyRiskOverlay(
            overrideAdjustedPermissions.mergedPermissions,
            mergedRiskSignals,
            {
              mergeTrace: overrideAdjustedPermissions.mergeTrace,
            },
          );

    return {
      sourceIdentityType: previewDto.sourceIdentityType ?? null,
      connectionType: previewDto.connectionType,
      trustState: previewDto.trustState,
      template: {
        id: template.id,
        sourceIdentityType: template.sourceIdentityType,
        connectionType: template.connectionType,
        templateKey: template.templateKey,
        displayName: template.displayName,
        description: template.description,
        policyVersion: template.policyVersion,
      },
      overridesSummary: createOverrideSummaryFromMap(overridesByPermissionKey),
      riskSummary: riskAdjustedPermissions.riskSummary,
      finalPermissions: riskAdjustedPermissions.mergedPermissions,
      mergeTrace: riskAdjustedPermissions.mergeTrace,
      previewRiskSignals: mergedRiskSignals,
    };
  }

  async resolveContentPermissionsForConnection(
    resolveDto: ResolveContentPermissionsForConnectionDto,
  ): Promise<ResolvedContentPermissionsForConnectionResult> {
    const resolvedConnection = await this.resolveConnectionPermissions({
      connectionId: resolveDto.connectionId,
      persistSnapshot: false,
    });
    const contentRule = await this.getContentAccessRule({
      contentId: resolveDto.contentId,
      targetIdentityId: resolveDto.targetIdentityId,
    });
    const baseConnectionPermissions =
      deriveContentPermissionSubset(resolvedConnection);
    const contentResolution = applyContentAccessRule(
      baseConnectionPermissions,
      contentRule,
      {
        contentId: resolveDto.contentId,
        targetIdentityId: resolveDto.targetIdentityId,
        currentViewCount: resolveDto.currentViewCount,
      },
    );

    return {
      connection: {
        id: resolvedConnection.connectionId,
        sourceIdentityId: resolvedConnection.sourceIdentityId,
        targetIdentityId: resolvedConnection.targetIdentityId,
        sourceIdentityType: resolvedConnection.sourceIdentityType,
        connectionType: resolvedConnection.connectionType,
        trustState: resolvedConnection.trustState,
        status: resolvedConnection.status,
        templateKey: resolvedConnection.template.templateKey,
        policyVersion: resolvedConnection.template.policyVersion,
      },
      contentSummary: contentResolution.contentSummary,
      baseConnectionPermissions,
      effectiveContentPermissions:
        contentResolution.effectiveContentPermissions,
      contentTrace: contentResolution.contentTrace,
      restrictionSummary: contentResolution.restrictionSummary,
    };
  }

  async previewContentPermissions(
    previewDto: PreviewContentPermissionsDto,
  ): Promise<PreviewContentPermissionsResult> {
    const previewPermissions = await this.previewPermissionsWithRisk({
      sourceIdentityType: previewDto.sourceIdentityType ?? null,
      connectionType: previewDto.connectionType,
      trustState: previewDto.trustState,
      manualOverrides: previewDto.manualOverrides,
      previewRiskSignals: previewDto.previewRiskSignals,
      applyRiskOverlay: previewDto.applyRiskOverlay,
    });
    const contentRule = previewDto.contentRule
      ? createPreviewContentAccessRuleValue(
          previewDto.contentId,
          previewDto.targetIdentityId,
          previewDto.contentRule,
        )
      : null;
    const baseConnectionPermissions =
      deriveContentPermissionSubsetFromFinalPermissions(
        previewPermissions.finalPermissions,
      );
    const contentResolution = applyContentAccessRule(
      baseConnectionPermissions,
      contentRule,
      {
        contentId: previewDto.contentId,
        targetIdentityId: previewDto.targetIdentityId,
        currentViewCount: previewDto.currentViewCount,
      },
    );

    return {
      sourceIdentityType: previewDto.sourceIdentityType ?? null,
      connectionType: previewDto.connectionType,
      trustState: previewDto.trustState,
      contentSummary: contentResolution.contentSummary,
      baseConnectionPermissions,
      effectiveContentPermissions:
        contentResolution.effectiveContentPermissions,
      contentTrace: contentResolution.contentTrace,
      restrictionSummary: contentResolution.restrictionSummary,
      riskSummary: previewPermissions.riskSummary,
    };
  }

  async bindResolvedPermissionsToConversation(
    bindDto: BindResolvedPermissionsToConversationDto,
  ): Promise<BoundConversationPermissions> {
    const conversation = await this.requireConversation(bindDto.conversationId);
    const resolvedPermissions = await this.resolveConnectionPermissions({
      connectionId: conversation.connectionId,
      persistSnapshot: false,
    });
    const currentHash = computeResolvedPermissionHash(resolvedPermissions);
    const updatedConversation =
      await this.prismaService.identityConversation.update({
        where: {
          id: bindDto.conversationId,
        },
        data: {
          lastResolvedAt: resolvedPermissions.resolvedAt,
          lastPermissionHash: currentHash,
        },
        select: identityConversationSelect,
      });
    const bindingSummary = createConversationBindingSummary(
      updatedConversation.lastPermissionHash,
      currentHash,
      updatedConversation.lastResolvedAt,
      resolvedPermissions.resolvedAt,
    );
    this.invalidateConversationContextCache(bindDto.conversationId);

    return {
      conversationId: updatedConversation.id,
      connectionId: updatedConversation.connectionId,
      sourceIdentityId: updatedConversation.sourceIdentityId,
      targetIdentityId: updatedConversation.targetIdentityId,
      conversationType: normalizeConversationType(
        updatedConversation.conversationType,
      ),
      conversationStatus: normalizeConversationStatus(
        updatedConversation.status,
      ),
      resolvedConnectionPermissions: resolvedPermissions,
      contentCapabilitySummary:
        deriveConversationContentCapabilitySummary(resolvedPermissions),
      bindingSummary,
      traceSummary: createConversationTraceSummary(resolvedPermissions),
      resolvedAt: resolvedPermissions.resolvedAt,
      stale: false,
    };
  }

  async isConversationPermissionBindingStale(
    conversationId: string,
  ): Promise<ConversationBindingStalenessResult> {
    const conversation = await this.requireConversation(conversationId);
    const resolvedPermissions = await this.resolveConnectionPermissions({
      connectionId: conversation.connectionId,
      persistSnapshot: false,
    });
    const currentHash = computeResolvedPermissionHash(resolvedPermissions);
    const stale =
      conversation.lastResolvedAt === null ||
      conversation.lastPermissionHash === null ||
      conversation.lastPermissionHash !== currentHash;

    return {
      stale,
      currentHash,
      storedHash: conversation.lastPermissionHash,
      lastResolvedAt: conversation.lastResolvedAt,
      currentResolvedAt: resolvedPermissions.resolvedAt,
    };
  }

  async resolveConversationContext(
    resolveDto: ResolveConversationContextDto,
  ): Promise<ResolveConversationContextResult> {
    const conversation = await this.requireConversation(
      resolveDto.conversationId,
    );
    const cacheKey = createConversationContextCacheKey(
      resolveDto.conversationId,
    );
    const cachedContext =
      this.conversationContextCache.get<CachedConversationContext>(cacheKey);

    if (
      cachedContext &&
      cachedContext.versionTag === PERMISSION_RESOLVER_VERSION &&
      cachedContext.value.context.conversation.updatedAt.getTime() ===
        conversation.updatedAt.getTime() &&
      !cachedContext.value.context.stale
    ) {
      return cachedContext.value.context;
    }

    const resolvedPermissions = await this.resolveConnectionPermissions({
      connectionId: conversation.connectionId,
      persistSnapshot: false,
    });
    const currentHash = computeResolvedPermissionHash(resolvedPermissions);
    const bindingSummary = createConversationBindingSummary(
      conversation.lastPermissionHash,
      currentHash,
      conversation.lastResolvedAt,
      resolvedPermissions.resolvedAt,
    );

    const result = {
      conversation: toIdentityConversationContext(conversation),
      resolvedPermissions,
      stale: bindingSummary.stale,
      bindingSummary,
      traceSummary: createConversationTraceSummary(resolvedPermissions),
    };

    if (!result.stale) {
      this.conversationContextCache.set<CachedConversationContext>(
        cacheKey,
        {
          cacheKey,
          context: result,
          permissionHash: currentHash,
          resolverVersion: PERMISSION_RESOLVER_VERSION,
        },
        30_000,
        PERMISSION_RESOLVER_VERSION,
      );
    }

    return result;
  }

  async persistResolvedPermissionSnapshot(
    connectionId: string,
    resolved: ResolvedConnectionPermissions,
  ): Promise<ConnectionPermissionSnapshotRecord> {
    const metadata = await this.buildPermissionSnapshotMetadata(
      connectionId,
      resolved,
    );
    const snapshot =
      await this.prismaService.connectionPermissionSnapshot.create({
        data: {
          connectionId,
          policyVersion: resolved.template.policyVersion,
          permissionsJson: toRequiredJsonInput(
            toConnectionPolicyTemplatePermissions(resolved.permissions),
          ),
          metadataJson: toNullableJsonInput(metadata),
          computedAt: resolved.resolvedAt,
        },
      });

    return {
      id: snapshot.id,
      connectionId: snapshot.connectionId,
      policyVersion: snapshot.policyVersion,
      permissionsJson:
        snapshot.permissionsJson as unknown as ConnectionPolicyTemplatePermissions,
      metadataJson: metadata,
      computedAt: snapshot.computedAt,
    };
  }

  async getLatestPermissionSnapshot(
    getLatestSnapshotDto: GetLatestPermissionSnapshotDto,
  ): Promise<ConnectionPermissionSnapshotRecord | null> {
    const snapshot =
      await this.prismaService.connectionPermissionSnapshot.findFirst({
        where: {
          connectionId: getLatestSnapshotDto.connectionId,
        },
        orderBy: [{ computedAt: "desc" }, { id: "desc" }],
      });

    if (!snapshot) {
      return null;
    }

    return {
      id: snapshot.id,
      connectionId: snapshot.connectionId,
      policyVersion: snapshot.policyVersion,
      permissionsJson:
        snapshot.permissionsJson as unknown as ConnectionPolicyTemplatePermissions,
      metadataJson:
        (snapshot.metadataJson as PermissionSnapshotMetadata | null) ?? null,
      computedAt: snapshot.computedAt,
    };
  }

  async isSnapshotFresh(
    connectionId: string,
    snapshot: ConnectionPermissionSnapshotRecord | null,
    options?: {
      applyRiskOverlay?: boolean;
      previewRiskSignals?: RiskSignalRecord[];
    },
  ): Promise<SnapshotFreshnessCheckResult> {
    if (!snapshot) {
      return {
        fresh: false,
        reason: "MISSING",
        expectedSourceHash: null,
        actualSourceHash: null,
      };
    }

    if (!snapshot.metadataJson) {
      return {
        fresh: false,
        reason: "MISSING_METADATA",
        expectedSourceHash: null,
        actualSourceHash: null,
      };
    }

    if ((options?.previewRiskSignals?.length ?? 0) > 0) {
      return {
        fresh: false,
        reason: "RISK_PREVIEW_UNSAFE",
        expectedSourceHash: null,
        actualSourceHash: snapshot.metadataJson.sourceHash,
      };
    }

    if (snapshot.metadataJson.resolverVersion !== PERMISSION_RESOLVER_VERSION) {
      return {
        fresh: false,
        reason: "RESOLVER_VERSION_MISMATCH",
        expectedSourceHash: null,
        actualSourceHash: snapshot.metadataJson.sourceHash,
      };
    }

    const expectedSourceHash = await this.computePermissionSourceHash(
      connectionId,
      options,
    );

    return {
      fresh: expectedSourceHash === snapshot.metadataJson.sourceHash,
      reason:
        expectedSourceHash === snapshot.metadataJson.sourceHash
          ? "FRESH"
          : "SOURCE_HASH_MISMATCH",
      expectedSourceHash,
      actualSourceHash: snapshot.metadataJson.sourceHash,
    };
  }

  async computePermissionSourceHash(
    connectionId: string,
    options?: {
      applyRiskOverlay?: boolean;
      previewRiskSignals?: RiskSignalRecord[];
    },
  ): Promise<string> {
    const connection = await this.requireConnection(connectionId);
    const sourceIdentity = await this.requireIdentity(
      connection.sourceIdentityId,
    );
    const template = await this.getConnectionPolicyTemplate({
      sourceIdentityType: toApiIdentityType(sourceIdentity.identityType),
      connectionType: toApiConnectionType(connection.connectionType),
    });
    const overrides = await this.listPermissionOverridesForConnection({
      connectionId,
    });
    const latestOverrideCreatedAt = overrides.reduce<number>(
      (latest, override) => Math.max(latest, override.createdAt.getTime()),
      0,
    );
    const sourcePayload = {
      connectionUpdatedAt: (
        connection.updatedAt ?? connection.createdAt
      ).toISOString(),
      sourceIdentityUpdatedAt: (
        sourceIdentity.updatedAt ??
        sourceIdentity.createdAt ??
        new Date(0)
      ).toISOString(),
      connectionType: toApiConnectionType(connection.connectionType),
      trustState: toApiTrustState(connection.trustState),
      relationshipType: toConnectionRelationshipType(connection),
      templateKey: template.templateKey,
      templatePolicyVersion: template.policyVersion,
      overrideCount: overrides.length,
      latestOverrideCreatedAt,
      applyRiskOverlay: options?.applyRiskOverlay ?? true,
      previewRiskSignals: options?.previewRiskSignals ?? [],
      resolverVersion: PERMISSION_RESOLVER_VERSION,
    };

    return createHash("sha256")
      .update(JSON.stringify(sourcePayload))
      .digest("hex");
  }

  private async getFreshCachedResolvedPermissions(
    connectionId: string,
    options?: {
      applyRiskOverlay?: boolean;
      previewRiskSignals?: RiskSignalRecord[];
    },
  ): Promise<CachedResolvedConnectionPermissions | null> {
    const cacheKey = createConnectionPermissionCacheKey(connectionId);
    const cached =
      this.permissionCache.get<CachedResolvedConnectionPermissions>(cacheKey);

    if (!cached) {
      return null;
    }

    if (cached.versionTag !== PERMISSION_RESOLVER_VERSION) {
      this.permissionCache.delete(cacheKey);
      return null;
    }

    const sourceHash = await this.computePermissionSourceHash(
      connectionId,
      options,
    );

    if (cached.value.sourceHash !== sourceHash) {
      this.permissionCache.delete(cacheKey);
      return null;
    }

    return cached.value;
  }

  private async storeResolvedPermissionsInCache(
    connectionId: string,
    resolved: ResolvedConnectionPermissions,
    options?: {
      applyRiskOverlay?: boolean;
      previewRiskSignals?: RiskSignalRecord[];
    },
  ) {
    const sourceHash = await this.computePermissionSourceHash(
      connectionId,
      options,
    );
    const cacheKey = createConnectionPermissionCacheKey(connectionId);

    this.permissionCache.set<CachedResolvedConnectionPermissions>(
      cacheKey,
      {
        cacheKey,
        resolved,
        sourceHash,
        resolverVersion: PERMISSION_RESOLVER_VERSION,
      },
      30_000,
      PERMISSION_RESOLVER_VERSION,
    );
  }

  private async hydrateResolvedPermissionsFromSnapshot(
    connectionId: string,
    snapshot: ConnectionPermissionSnapshotRecord,
    options?: {
      applyRiskOverlay?: boolean;
      previewRiskSignals?: RiskSignalRecord[];
    },
  ): Promise<ResolvedConnectionPermissions | null> {
    const resolved = await this.resolveConnectionPermissionsCore(connectionId, {
      applyRiskOverlay: options?.applyRiskOverlay,
      previewRiskSignals: options?.previewRiskSignals,
    });

    await this.storeResolvedPermissionsInCache(connectionId, resolved, options);
    return resolved;
  }

  private async buildPermissionSnapshotMetadata(
    connectionId: string,
    resolved: ResolvedConnectionPermissions,
  ): Promise<PermissionSnapshotMetadata> {
    const sourceHash = await this.computePermissionSourceHash(connectionId, {
      applyRiskOverlay: true,
    });

    return {
      resolverVersion: PERMISSION_RESOLVER_VERSION,
      templateKey: resolved.template.templateKey,
      templatePolicyVersion: resolved.template.policyVersion,
      trustState: resolved.trustState,
      connectionType: resolved.connectionType,
      relationshipType: resolved.relationshipType,
      overrideCount: resolved.overridesSummary.count,
      riskSummaryHash: createHash("sha256")
        .update(JSON.stringify(resolved.riskSummary))
        .digest("hex"),
      sourceHash,
      computedAt: resolved.resolvedAt,
    };
  }

  private applyOverridePreviewToPermissionSet(
    basePermissions: ConnectionPolicyTemplatePermissions,
    overrides: ManualOverrideMap,
    options: {
      trustState: TrustState;
      templateKey: string;
      mergeTrace: PreviewPermissionsWithTrustStateResult["mergeTrace"];
    },
  ) {
    return applyManualOverrides(basePermissions, overrides, options);
  }

  private async resolveConnectionPermissionsCore(
    connectionId: string,
    options?: {
      applyRiskOverlay?: boolean;
      previewRiskSignals?: RiskSignalRecord[];
    },
  ): Promise<ResolvedConnectionPermissions> {
    const connection = await this.requireConnection(connectionId);
    const sourceIdentity = await this.prismaService.identity.findUnique({
      where: {
        id: connection.sourceIdentityId,
      },
      select: {
        id: true,
        identityType: true,
      },
    });

    if (!sourceIdentity) {
      throw new NotFoundException("Source identity not found");
    }

    const sourceIdentityType = toApiIdentityType(sourceIdentity.identityType);

    if (!sourceIdentityType) {
      throw new NotFoundException("Source identity type not found");
    }
    const targetIdentity = await this.prismaService.identity.findUnique({
      where: {
        id: connection.targetIdentityId,
      },
      select: {
        id: true,
        identityType: true,
      },
    });

    if (!targetIdentity) {
      throw new NotFoundException("Target identity not found");
    }

    const targetIdentityType = toApiIdentityType(targetIdentity.identityType);

    if (!targetIdentityType) {
      throw new NotFoundException("Target identity type not found");
    }

    const resolvedTrustState = toApiTrustState(connection.trustState);
    const connectionType = toApiConnectionType(connection.connectionType);
    const relationshipType =
      toApiRelationshipType(connection.relationshipType) ??
      inferRelationshipTypeFromConnectionType(connectionType);
    const template = await this.getConnectionPolicyTemplate({
      sourceIdentityType,
      connectionType,
    });
    const behaviorAdjustedPermissions = applyIdentityTypeBehavior(
      template.permissionsJson,
      sourceIdentityType,
      targetIdentityType,
    );
    const relationshipAdjustedPermissions = applyRelationshipBehavior(
      behaviorAdjustedPermissions.mergedPermissions,
      relationshipType,
    );
    const trustAdjustedPermissions = applyTrustStateAdjustment(
      relationshipAdjustedPermissions.mergedPermissions,
      resolvedTrustState,
    );
    const behaviorRelationshipTrace = mergeBehaviorTraceWithRelationshipTrace(
      behaviorAdjustedPermissions.mergeTrace,
      relationshipAdjustedPermissions.relationshipTrace,
    );
    const behaviorTrustTrace = mergeRelationshipTraceWithTrustTrace(
      behaviorRelationshipTrace,
      trustAdjustedPermissions.mergeTrace,
    );
    const overrideItems = await this.listPermissionOverridesForConnection({
      connectionId,
    });
    const overridesByPermissionKey = mapOverridesByPermissionKey(overrideItems);
    const overrideAdjustedPermissions =
      this.applyOverridePreviewToPermissionSet(
        trustAdjustedPermissions.mergedPermissions,
        overridesByPermissionKey,
        {
          trustState: resolvedTrustState,
          templateKey: template.templateKey,
          mergeTrace: behaviorTrustTrace,
        },
      );
    const mergedRiskSignals = mergeRiskSignals(
      deriveRiskSignalsFromTrustState(resolvedTrustState),
      options?.previewRiskSignals ?? [],
    );
    const riskAdjustedPermissions =
      options?.applyRiskOverlay === false
        ? {
            mergedPermissions: overrideAdjustedPermissions.mergedPermissions,
            mergeTrace: overrideAdjustedPermissions.mergeTrace,
            riskSummary: createEmptyRiskSummary(),
          }
        : applyRiskOverlay(
            overrideAdjustedPermissions.mergedPermissions,
            mergedRiskSignals,
            {
              mergeTrace: overrideAdjustedPermissions.mergeTrace,
            },
          );

    return {
      connectionId: connection.id,
      sourceIdentityId: connection.sourceIdentityId,
      targetIdentityId: connection.targetIdentityId,
      sourceIdentityType,
      relationshipType,
      connectionType,
      trustState: resolvedTrustState,
      status: toApiConnectionStatus(connection.status),
      template: {
        templateKey: template.templateKey,
        policyVersion: template.policyVersion,
      },
      identityBehaviorSummary: behaviorAdjustedPermissions.behaviorSummary,
      relationshipBehaviorSummary:
        relationshipAdjustedPermissions.relationshipSummary,
      overridesSummary: createOverrideSummary(overrideItems),
      riskSummary: riskAdjustedPermissions.riskSummary,
      permissions: toResolvedPermissionMap(
        riskAdjustedPermissions.mergedPermissions,
        riskAdjustedPermissions.mergeTrace,
      ),
      trace: sortTraceEntries(riskAdjustedPermissions.mergeTrace),
      resolvedAt: new Date(),
    };
  }

  private async requireConnection(
    connectionId: string,
  ): Promise<IdentityConnectionRecord> {
    const connection = await this.prismaService.identityConnection.findUnique({
      where: {
        id: connectionId,
      },
      select: identityConnectionSelect,
    });

    if (!connection) {
      throw new NotFoundException("Identity connection not found");
    }

    return connection;
  }

  private async requireConversation(
    conversationId: string,
  ): Promise<IdentityConversationRecord> {
    const conversation =
      await this.prismaService.identityConversation.findUnique({
        where: {
          id: conversationId,
        },
        select: identityConversationSelect,
      });

    if (!conversation) {
      throw new NotFoundException("Identity conversation not found");
    }

    return conversation;
  }

  private async requireIdentity(identityId: string): Promise<Identity> {
    const identity = await this.prismaService.identity.findUnique({
      where: {
        id: identityId,
      },
    });

    if (!identity) {
      throw new NotFoundException("Identity not found");
    }

    return identity;
  }

  private assertConversationMatchesConnection(
    conversation: Pick<
      CreateConversationDto,
      "sourceIdentityId" | "targetIdentityId" | "connectionId"
    >,
    connection: IdentityConnectionRecord,
  ): void {
    if (
      conversation.connectionId !== connection.id ||
      conversation.sourceIdentityId !== connection.sourceIdentityId ||
      conversation.targetIdentityId !== connection.targetIdentityId
    ) {
      throw new BadRequestException(
        "Conversation source and target must match the referenced connection direction",
      );
    }
  }

  private assertConversationTypeCompatibility(
    conversationType: ConversationType,
    resolvedPermissions: ResolvedConnectionPermissions,
    sourceIdentityType: IdentityType,
    targetIdentityType: IdentityType,
  ): void {
    const behavior = this.getIdentityTypeBehavior(
      sourceIdentityType,
      targetIdentityType,
    );

    if (
      resolvedPermissions.status === ConnectionStatus.Blocked ||
      resolvedPermissions.status === ConnectionStatus.Archived
    ) {
      throw new BadRequestException(
        "Conversation cannot be created for blocked or archived connections",
      );
    }

    if (conversationType === ConversationType.ProtectedDirect) {
      const protectedCapable =
        resolvedPermissions.permissions[
          PERMISSION_KEYS.mediaPrivacy.protectedSend
        ]?.finalEffect !== PermissionEffect.Deny ||
        resolvedPermissions.permissions[PERMISSION_KEYS.vault.itemView]
          ?.finalEffect !== PermissionEffect.Deny ||
        resolvedPermissions.permissions[PERMISSION_KEYS.vault.itemAttach]
          ?.finalEffect !== PermissionEffect.Deny;

      if (
        !protectedCapable ||
        (!behavior.summary.restrictionFlags.prefersProtectedConversation &&
          !resolvedPermissions.identityBehaviorSummary.restrictionFlags
            .prefersProtectedConversation &&
          false) ||
        (behavior.sourceBehavior.allowsProtectedConversation === false &&
          (behavior.pairBehavior?.allowsProtectedConversation ?? true) ===
            false) ||
        resolvedPermissions.riskSummary.blockedProtectedMode === true
      ) {
        throw new BadRequestException(
          "Protected direct conversations require protected-capable permissions",
        );
      }
    }

    if (conversationType === ConversationType.BusinessDirect) {
      if (!behavior.summary.restrictionFlags.allowsBusinessConversation) {
        throw new BadRequestException(
          "Business direct conversations require business or professional identities",
        );
      }
    }
  }

  private assertNotSelfConnection(
    sourceIdentityId: string,
    targetIdentityId: string,
  ): void {
    if (sourceIdentityId === targetIdentityId) {
      throw new BadRequestException(
        "Identity connections cannot target the same identity",
      );
    }
  }

  private normalizeStatusForConnection(
    connectionType: ConnectionType,
    trustState: TrustState,
    requestedStatus: ConnectionStatus,
  ): ConnectionStatus {
    if (connectionType === ConnectionType.Blocked) {
      return ConnectionStatus.Blocked;
    }

    if (trustState === TrustState.Blocked) {
      return ConnectionStatus.Blocked;
    }

    if (trustState === TrustState.HighRisk) {
      return requestedStatus === ConnectionStatus.Blocked
        ? ConnectionStatus.Blocked
        : ConnectionStatus.Restricted;
    }

    return requestedStatus;
  }

  private mapKnownError(error: unknown, conflictMessage: string): Error {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return new ConflictException(conflictMessage);
    }

    return error as Error;
  }
}

function toPrismaIdentityType(identityType: IdentityType): PrismaIdentityType {
  switch (identityType) {
    case IdentityType.Personal:
      return PrismaIdentityType.PERSONAL;
    case IdentityType.Professional:
      return PrismaIdentityType.PROFESSIONAL;
    case IdentityType.Business:
      return PrismaIdentityType.BUSINESS;
    case IdentityType.Couple:
      return PrismaIdentityType.COUPLE;
    case IdentityType.Family:
      return PrismaIdentityType.FAMILY;
  }

  throw new Error("Unsupported identity type");
}

function toNullablePrismaIdentityType(
  identityType: IdentityType | null,
): PrismaIdentityType | null {
  return identityType === null ? null : toPrismaIdentityType(identityType);
}

function toPrismaRelationshipType(
  relationshipType: RelationshipType,
): PrismaRelationshipType {
  switch (relationshipType) {
    case RelationshipType.Unknown:
      return PrismaRelationshipType.UNKNOWN;
    case RelationshipType.Friend:
      return PrismaRelationshipType.FRIEND;
    case RelationshipType.Partner:
      return PrismaRelationshipType.PARTNER;
    case RelationshipType.FamilyMember:
      return PrismaRelationshipType.FAMILY_MEMBER;
    case RelationshipType.Colleague:
      return PrismaRelationshipType.COLLEAGUE;
    case RelationshipType.Client:
      return PrismaRelationshipType.CLIENT;
    case RelationshipType.Vendor:
      return PrismaRelationshipType.VENDOR;
    case RelationshipType.VerifiedBusinessContact:
      return PrismaRelationshipType.VERIFIED_BUSINESS_CONTACT;
    case RelationshipType.InnerCircle:
      return PrismaRelationshipType.INNER_CIRCLE;
    case RelationshipType.HouseholdService:
      return PrismaRelationshipType.HOUSEHOLD_SERVICE;
    case RelationshipType.SupportAgent:
      return PrismaRelationshipType.SUPPORT_AGENT;
  }

  throw new Error("Unsupported relationship type");
}

function toNullablePrismaRelationshipType(
  relationshipType: RelationshipType | null,
): PrismaRelationshipType | null {
  return relationshipType === null
    ? null
    : toPrismaRelationshipType(relationshipType);
}

function toApiIdentityType(
  identityType: PrismaIdentityType | null,
): IdentityType | null {
  if (identityType === null) {
    return null;
  }

  switch (identityType) {
    case PrismaIdentityType.PERSONAL:
      return IdentityType.Personal;
    case PrismaIdentityType.PROFESSIONAL:
      return IdentityType.Professional;
    case PrismaIdentityType.BUSINESS:
      return IdentityType.Business;
    case PrismaIdentityType.COUPLE:
      return IdentityType.Couple;
    case PrismaIdentityType.FAMILY:
      return IdentityType.Family;
  }

  throw new Error("Unsupported identity type");
}

function toApiRelationshipType(
  relationshipType: PrismaRelationshipType | null | undefined,
): RelationshipType | null {
  if (relationshipType === null || relationshipType === undefined) {
    return null;
  }

  switch (relationshipType) {
    case PrismaRelationshipType.UNKNOWN:
      return RelationshipType.Unknown;
    case PrismaRelationshipType.FRIEND:
      return RelationshipType.Friend;
    case PrismaRelationshipType.PARTNER:
      return RelationshipType.Partner;
    case PrismaRelationshipType.FAMILY_MEMBER:
      return RelationshipType.FamilyMember;
    case PrismaRelationshipType.COLLEAGUE:
      return RelationshipType.Colleague;
    case PrismaRelationshipType.CLIENT:
      return RelationshipType.Client;
    case PrismaRelationshipType.VENDOR:
      return RelationshipType.Vendor;
    case PrismaRelationshipType.VERIFIED_BUSINESS_CONTACT:
      return RelationshipType.VerifiedBusinessContact;
    case PrismaRelationshipType.INNER_CIRCLE:
      return RelationshipType.InnerCircle;
    case PrismaRelationshipType.HOUSEHOLD_SERVICE:
      return RelationshipType.HouseholdService;
    case PrismaRelationshipType.SUPPORT_AGENT:
      return RelationshipType.SupportAgent;
  }

  throw new Error("Unsupported relationship type");
}

function toPrismaConnectionType(
  connectionType: ConnectionType,
): PrismaConnectionType {
  switch (connectionType) {
    case ConnectionType.Unknown:
      return PrismaConnectionType.UNKNOWN;
    case ConnectionType.Requested:
      return PrismaConnectionType.REQUESTED;
    case ConnectionType.Known:
      return PrismaConnectionType.KNOWN;
    case ConnectionType.Trusted:
      return PrismaConnectionType.TRUSTED;
    case ConnectionType.InnerCircle:
      return PrismaConnectionType.INNER_CIRCLE;
    case ConnectionType.Family:
      return PrismaConnectionType.FAMILY;
    case ConnectionType.Partner:
      return PrismaConnectionType.PARTNER;
    case ConnectionType.Colleague:
      return PrismaConnectionType.COLLEAGUE;
    case ConnectionType.Client:
      return PrismaConnectionType.CLIENT;
    case ConnectionType.Vendor:
      return PrismaConnectionType.VENDOR;
    case ConnectionType.VerifiedBusiness:
      return PrismaConnectionType.VERIFIED_BUSINESS;
    case ConnectionType.AdminManaged:
      return PrismaConnectionType.ADMIN_MANAGED;
    case ConnectionType.Blocked:
      return PrismaConnectionType.BLOCKED;
    case ConnectionType.SuspendedRisky:
      return PrismaConnectionType.SUSPENDED_RISKY;
  }

  throw new Error("Unsupported connection type");
}

function toApiConnectionType(
  connectionType: PrismaConnectionType,
): ConnectionType {
  switch (connectionType) {
    case PrismaConnectionType.UNKNOWN:
      return ConnectionType.Unknown;
    case PrismaConnectionType.REQUESTED:
      return ConnectionType.Requested;
    case PrismaConnectionType.KNOWN:
      return ConnectionType.Known;
    case PrismaConnectionType.TRUSTED:
      return ConnectionType.Trusted;
    case PrismaConnectionType.INNER_CIRCLE:
      return ConnectionType.InnerCircle;
    case PrismaConnectionType.FAMILY:
      return ConnectionType.Family;
    case PrismaConnectionType.PARTNER:
      return ConnectionType.Partner;
    case PrismaConnectionType.COLLEAGUE:
      return ConnectionType.Colleague;
    case PrismaConnectionType.CLIENT:
      return ConnectionType.Client;
    case PrismaConnectionType.VENDOR:
      return ConnectionType.Vendor;
    case PrismaConnectionType.VERIFIED_BUSINESS:
      return ConnectionType.VerifiedBusiness;
    case PrismaConnectionType.ADMIN_MANAGED:
      return ConnectionType.AdminManaged;
    case PrismaConnectionType.BLOCKED:
      return ConnectionType.Blocked;
    case PrismaConnectionType.SUSPENDED_RISKY:
      return ConnectionType.SuspendedRisky;
  }

  throw new Error("Unsupported connection type");
}

function toPrismaTrustState(trustState: TrustState): PrismaTrustState {
  switch (trustState) {
    case TrustState.Unverified:
      return PrismaTrustState.UNVERIFIED;
    case TrustState.BasicVerified:
      return PrismaTrustState.BASIC_VERIFIED;
    case TrustState.StrongVerified:
      return PrismaTrustState.STRONG_VERIFIED;
    case TrustState.TrustedByUser:
      return PrismaTrustState.TRUSTED_BY_USER;
    case TrustState.HighRisk:
      return PrismaTrustState.HIGH_RISK;
    case TrustState.Restricted:
      return PrismaTrustState.RESTRICTED;
    case TrustState.Blocked:
      return PrismaTrustState.BLOCKED;
  }

  throw new Error("Unsupported trust state");
}

function toApiTrustState(trustState: PrismaTrustState): TrustState {
  switch (trustState) {
    case PrismaTrustState.UNVERIFIED:
      return TrustState.Unverified;
    case PrismaTrustState.BASIC_VERIFIED:
      return TrustState.BasicVerified;
    case PrismaTrustState.STRONG_VERIFIED:
      return TrustState.StrongVerified;
    case PrismaTrustState.TRUSTED_BY_USER:
      return TrustState.TrustedByUser;
    case PrismaTrustState.HIGH_RISK:
      return TrustState.HighRisk;
    case PrismaTrustState.RESTRICTED:
      return TrustState.Restricted;
    case PrismaTrustState.BLOCKED:
      return TrustState.Blocked;
  }

  throw new Error("Unsupported trust state");
}

function toPrismaConnectionStatus(
  status: ConnectionStatus,
): PrismaConnectionStatus {
  switch (status) {
    case ConnectionStatus.Pending:
      return PrismaConnectionStatus.PENDING;
    case ConnectionStatus.Active:
      return PrismaConnectionStatus.ACTIVE;
    case ConnectionStatus.Restricted:
      return PrismaConnectionStatus.RESTRICTED;
    case ConnectionStatus.Blocked:
      return PrismaConnectionStatus.BLOCKED;
    case ConnectionStatus.Archived:
      return PrismaConnectionStatus.ARCHIVED;
  }

  throw new Error("Unsupported connection status");
}

function toApiConnectionStatus(
  status: PrismaConnectionStatus,
): ConnectionStatus {
  switch (status) {
    case PrismaConnectionStatus.PENDING:
      return ConnectionStatus.Pending;
    case PrismaConnectionStatus.ACTIVE:
      return ConnectionStatus.Active;
    case PrismaConnectionStatus.RESTRICTED:
      return ConnectionStatus.Restricted;
    case PrismaConnectionStatus.BLOCKED:
      return ConnectionStatus.Blocked;
    case PrismaConnectionStatus.ARCHIVED:
      return ConnectionStatus.Archived;
  }

  throw new Error("Unsupported connection status");
}

function toPrismaPermissionEffect(
  effect: PermissionEffect,
): PrismaPermissionEffect {
  switch (effect) {
    case PermissionEffect.Allow:
      return PrismaPermissionEffect.ALLOW;
    case PermissionEffect.Deny:
      return PrismaPermissionEffect.DENY;
    case PermissionEffect.RequestApproval:
      return PrismaPermissionEffect.REQUEST_APPROVAL;
    case PermissionEffect.AllowWithLimits:
      return PrismaPermissionEffect.ALLOW_WITH_LIMITS;
  }

  throw new Error("Unsupported permission effect");
}

function toApiPermissionEffect(
  effect: PrismaPermissionEffect,
): PermissionEffect {
  switch (effect) {
    case PrismaPermissionEffect.ALLOW:
      return PermissionEffect.Allow;
    case PrismaPermissionEffect.DENY:
      return PermissionEffect.Deny;
    case PrismaPermissionEffect.REQUEST_APPROVAL:
      return PermissionEffect.RequestApproval;
    case PrismaPermissionEffect.ALLOW_WITH_LIMITS:
      return PermissionEffect.AllowWithLimits;
  }

  throw new Error("Unsupported permission effect");
}

function toNullableJsonInput(
  value: object | null | undefined,
): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue {
  return value === undefined || value === null
    ? Prisma.JsonNull
    : (value as Prisma.InputJsonValue);
}

function toRequiredJsonInput(value: object): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function toConnectionPolicyTemplateRecord(
  template: ConnectionPolicyTemplate,
): ConnectionPolicyTemplateRecord {
  return {
    id: template.id,
    sourceIdentityType: toApiIdentityType(template.sourceIdentityType),
    connectionType: toApiConnectionType(template.connectionType),
    templateKey: template.templateKey,
    displayName: template.displayName,
    description: template.description,
    policyVersion: template.policyVersion,
    permissionsJson:
      template.permissionsJson as unknown as ConnectionPolicyTemplatePermissions,
    limitsJson:
      template.limitsJson as unknown as ConnectionPolicyTemplateLimits | null,
    isSystem: template.isSystem,
    isActive: template.isActive,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

function toConnectionRelationshipType(
  connection: IdentityConnectionRecord,
): RelationshipType {
  return (
    toApiRelationshipType(connection.relationshipType) ??
    inferRelationshipTypeFromConnectionType(
      toApiConnectionType(connection.connectionType),
    )
  );
}

function toContentAccessRuleValue(
  contentRule: ContentAccessRuleRecord,
): ContentAccessRuleValue {
  return {
    contentId: contentRule.contentId,
    targetIdentityId: contentRule.targetIdentityId,
    canView: contentRule.canView,
    canDownload: contentRule.canDownload,
    canForward: contentRule.canForward,
    canExport: contentRule.canExport,
    screenshotPolicy: normalizeScreenshotPolicy(contentRule.screenshotPolicy),
    recordPolicy: normalizeRecordPolicy(contentRule.recordPolicy),
    expiryAt: contentRule.expiryAt,
    viewLimit: contentRule.viewLimit,
    watermarkMode: contentRule.watermarkMode,
    aiAccessAllowed: contentRule.aiAccessAllowed,
    metadataJson: contentRule.metadataJson as Record<string, unknown> | null,
    createdByIdentityId: contentRule.createdByIdentityId,
    createdAt: contentRule.createdAt,
    updatedAt: contentRule.updatedAt,
  };
}

function toIdentityConversationContext(
  conversation: IdentityConversationRecord,
): IdentityConversationContext {
  return {
    conversationId: conversation.id,
    connectionId: conversation.connectionId,
    sourceIdentityId: conversation.sourceIdentityId,
    targetIdentityId: conversation.targetIdentityId,
    conversationType: normalizeConversationType(conversation.conversationType),
    conversationStatus: normalizeConversationStatus(conversation.status),
    title: conversation.title,
    metadataJson: conversation.metadataJson as Record<string, unknown> | null,
    lastResolvedAt: conversation.lastResolvedAt,
    lastPermissionHash: conversation.lastPermissionHash,
    createdByIdentityId: conversation.createdByIdentityId,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

function createPreviewContentAccessRuleValue(
  contentId: string,
  targetIdentityId: string,
  previewRule: PreviewContentPermissionsDto["contentRule"],
): ContentAccessRuleValue {
  return {
    contentId,
    targetIdentityId,
    canView: previewRule?.canView ?? true,
    canDownload: previewRule?.canDownload ?? true,
    canForward: previewRule?.canForward ?? true,
    canExport: previewRule?.canExport ?? true,
    screenshotPolicy: previewRule?.screenshotPolicy ?? ScreenshotPolicy.Inherit,
    recordPolicy: previewRule?.recordPolicy ?? RecordPolicy.Inherit,
    expiryAt: previewRule?.expiryAt ? new Date(previewRule.expiryAt) : null,
    viewLimit: previewRule?.viewLimit ?? null,
    watermarkMode: previewRule?.watermarkMode ?? null,
    aiAccessAllowed: previewRule?.aiAccessAllowed ?? null,
    metadataJson: previewRule?.metadataJson ?? null,
    createdByIdentityId: "preview",
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

function normalizeScreenshotPolicy(value: string): ScreenshotPolicy {
  switch (value) {
    case ScreenshotPolicy.Allow:
      return ScreenshotPolicy.Allow;
    case ScreenshotPolicy.Deny:
      return ScreenshotPolicy.Deny;
    case ScreenshotPolicy.Inherit:
    default:
      return ScreenshotPolicy.Inherit;
  }
}

function normalizeRecordPolicy(value: string): RecordPolicy {
  switch (value) {
    case RecordPolicy.Allow:
      return RecordPolicy.Allow;
    case RecordPolicy.Deny:
      return RecordPolicy.Deny;
    case RecordPolicy.Inherit:
    default:
      return RecordPolicy.Inherit;
  }
}

function normalizeConversationType(value: string): ConversationType {
  switch (value) {
    case ConversationType.ProtectedDirect:
      return ConversationType.ProtectedDirect;
    case ConversationType.BusinessDirect:
      return ConversationType.BusinessDirect;
    case ConversationType.Direct:
    default:
      return ConversationType.Direct;
  }
}

function normalizeConversationStatus(value: string): ConversationStatus {
  switch (value) {
    case ConversationStatus.Archived:
      return ConversationStatus.Archived;
    case ConversationStatus.Blocked:
      return ConversationStatus.Blocked;
    case ConversationStatus.Locked:
      return ConversationStatus.Locked;
    case ConversationStatus.Active:
    default:
      return ConversationStatus.Active;
  }
}

function computeResolvedPermissionHash(
  resolvedPermissions: ResolvedConnectionPermissions,
): string {
  const normalizedPayload = {
    templateKey: resolvedPermissions.template.templateKey,
    policyVersion: resolvedPermissions.template.policyVersion,
    trustState: resolvedPermissions.trustState,
    overridesSummary: resolvedPermissions.overridesSummary,
    riskSummary: resolvedPermissions.riskSummary,
    permissions: Object.keys(resolvedPermissions.permissions)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, permissionKey) => {
        const permission =
          resolvedPermissions.permissions[
            permissionKey as keyof ResolvedConnectionPermissions["permissions"]
          ];

        if (!permission) {
          return accumulator;
        }

        accumulator[permissionKey] = {
          effect: permission.finalEffect,
          limits: permission.limits ?? null,
        };

        return accumulator;
      }, {}),
  };

  return createHash("sha256")
    .update(JSON.stringify(normalizedPayload))
    .digest("hex");
}

function createConversationBindingSummary(
  storedHash: string | null,
  currentHash: string,
  lastResolvedAt: Date | null,
  currentResolvedAt: Date,
): ConversationPermissionBindingSummary {
  return {
    storedHash,
    currentHash,
    lastResolvedAt,
    currentResolvedAt,
    stale:
      storedHash === null ||
      lastResolvedAt === null ||
      storedHash !== currentHash,
  };
}

function createConversationTraceSummary(
  resolvedPermissions: ResolvedConnectionPermissions,
): ConversationResolutionTrace {
  return {
    templateKey: resolvedPermissions.template.templateKey,
    policyVersion: resolvedPermissions.template.policyVersion,
    trustState: resolvedPermissions.trustState,
    overrideCount: resolvedPermissions.overridesSummary.count,
    riskSignals: resolvedPermissions.riskSummary.appliedSignals,
  };
}

function deriveConversationContentCapabilitySummary(
  resolvedPermissions: ResolvedConnectionPermissions,
) {
  return {
    protectedCapable:
      resolvedPermissions.permissions[
        PERMISSION_KEYS.mediaPrivacy.protectedSend
      ]?.finalEffect !== PermissionEffect.Deny,
    vaultCapable:
      resolvedPermissions.permissions[PERMISSION_KEYS.vault.itemView]
        ?.finalEffect !== PermissionEffect.Deny ||
      resolvedPermissions.permissions[PERMISSION_KEYS.vault.itemAttach]
        ?.finalEffect !== PermissionEffect.Deny,
    aiCapable:
      resolvedPermissions.permissions[PERMISSION_KEYS.ai.summaryUse]
        ?.finalEffect !== PermissionEffect.Deny,
  };
}

function mergeBehaviorTraceWithTrustTrace(
  behaviorTrace: PermissionMergeTrace,
  trustTrace: PermissionMergeTrace,
): PermissionMergeTrace {
  const mergedTrace = {} as PermissionMergeTrace;
  const permissionKeys = new Set([
    ...Object.keys(behaviorTrace),
    ...Object.keys(trustTrace),
  ]);

  for (const permissionKey of permissionKeys) {
    const typedPermissionKey = permissionKey as PermissionKey;
    const behaviorEntry = behaviorTrace[typedPermissionKey];
    const trustEntry = trustTrace[typedPermissionKey];

    if (!behaviorEntry && trustEntry) {
      mergedTrace[typedPermissionKey] = trustEntry;
      continue;
    }

    if (!trustEntry && behaviorEntry) {
      mergedTrace[typedPermissionKey] = behaviorEntry;
      continue;
    }

    if (!behaviorEntry || !trustEntry) {
      continue;
    }

    mergedTrace[typedPermissionKey] = {
      ...trustEntry,
      baseEffect: behaviorEntry.baseEffect,
      identityBehaviorEffect: behaviorEntry.identityBehaviorEffect,
      postIdentityBehaviorEffect: behaviorEntry.postIdentityBehaviorEffect,
      relationshipBehaviorEffect:
        behaviorEntry.relationshipBehaviorEffect ?? null,
      postRelationshipEffect:
        behaviorEntry.postRelationshipEffect ??
        behaviorEntry.postIdentityBehaviorEffect,
    };
  }

  return mergedTrace;
}

function mergeBehaviorTraceWithRelationshipTrace(
  behaviorTrace: PermissionMergeTrace,
  relationshipTrace: PermissionMergeTrace,
): PermissionMergeTrace {
  const mergedTrace = {} as PermissionMergeTrace;
  const permissionKeys = new Set([
    ...Object.keys(behaviorTrace),
    ...Object.keys(relationshipTrace),
  ]);

  for (const permissionKey of permissionKeys) {
    const typedPermissionKey = permissionKey as PermissionKey;
    const behaviorEntry = behaviorTrace[typedPermissionKey];
    const relationshipEntry = relationshipTrace[typedPermissionKey];

    if (!behaviorEntry && relationshipEntry) {
      mergedTrace[typedPermissionKey] = relationshipEntry;
      continue;
    }

    if (!relationshipEntry && behaviorEntry) {
      mergedTrace[typedPermissionKey] = behaviorEntry;
      continue;
    }

    if (!behaviorEntry || !relationshipEntry) {
      continue;
    }

    mergedTrace[typedPermissionKey] = {
      ...relationshipEntry,
      baseEffect: behaviorEntry.baseEffect,
      identityBehaviorEffect: behaviorEntry.identityBehaviorEffect,
      postIdentityBehaviorEffect: behaviorEntry.postIdentityBehaviorEffect,
      relationshipBehaviorEffect: relationshipEntry.identityBehaviorEffect,
      postRelationshipEffect: relationshipEntry.postIdentityBehaviorEffect,
    };
  }

  return mergedTrace;
}

function mergeRelationshipTraceWithTrustTrace(
  relationshipTrace: PermissionMergeTrace,
  trustTrace: PermissionMergeTrace,
): PermissionMergeTrace {
  const mergedTrace = {} as PermissionMergeTrace;
  const permissionKeys = new Set([
    ...Object.keys(relationshipTrace),
    ...Object.keys(trustTrace),
  ]);

  for (const permissionKey of permissionKeys) {
    const typedPermissionKey = permissionKey as PermissionKey;
    const relationshipEntry = relationshipTrace[typedPermissionKey];
    const trustEntry = trustTrace[typedPermissionKey];

    if (!relationshipEntry && trustEntry) {
      mergedTrace[typedPermissionKey] = trustEntry;
      continue;
    }

    if (!trustEntry && relationshipEntry) {
      mergedTrace[typedPermissionKey] = relationshipEntry;
      continue;
    }

    if (!relationshipEntry || !trustEntry) {
      continue;
    }

    mergedTrace[typedPermissionKey] = {
      ...trustEntry,
      baseEffect: relationshipEntry.baseEffect,
      identityBehaviorEffect: relationshipEntry.identityBehaviorEffect,
      postIdentityBehaviorEffect: relationshipEntry.postIdentityBehaviorEffect,
      relationshipBehaviorEffect: relationshipEntry.relationshipBehaviorEffect,
      postRelationshipEffect: relationshipEntry.postRelationshipEffect,
    };
  }

  return mergedTrace;
}

function mapConnectionPermissionOverrideRecord(override: {
  permissionKey: string;
  effect: PrismaPermissionEffect;
  limitsJson: Prisma.JsonValue | null;
  reason: string | null;
  createdAt: Date;
  createdByIdentityId: string;
}): ConnectionPermissionOverrideRecord {
  return {
    permissionKey:
      override.permissionKey as ConnectionPermissionOverrideRecord["permissionKey"],
    effect: toApiPermissionEffect(override.effect),
    limits: override.limitsJson as ConnectionPermissionOverrideRecord["limits"],
    reason: override.reason,
    createdAt: override.createdAt,
    createdByIdentityId: override.createdByIdentityId,
  };
}

function mapOverridesByPermissionKey(
  overrides: ConnectionPermissionOverrideRecord[],
): ManualOverrideMap {
  return overrides.reduce<ManualOverrideMap>((accumulator, override) => {
    accumulator[override.permissionKey] = {
      permissionKey: override.permissionKey,
      effect: override.effect,
      limits: override.limits,
      reason: override.reason,
      createdAt: override.createdAt,
      createdByIdentityId: override.createdByIdentityId,
    };

    return accumulator;
  }, {});
}

function createOverrideSummary(
  overrides: ConnectionPermissionOverrideRecord[],
): ConnectionPermissionResolutionSummary {
  return {
    count: overrides.length,
    overriddenKeys: [
      ...overrides.map((override) => override.permissionKey),
    ].sort(),
  };
}

function createOverrideSummaryFromMap(
  overrides: ManualOverrideMap,
): ConnectionPermissionResolutionSummary {
  const overrideKeys = Object.keys(
    overrides,
  ).sort() as ConnectionPermissionResolutionSummary["overriddenKeys"];

  return {
    count: overrideKeys.length,
    overriddenKeys: overrideKeys,
  };
}

function mapManualOverridesFromPreview(
  manualOverrides: PreviewPermissionsWithRiskDto["manualOverrides"],
): ManualOverrideMap {
  return (manualOverrides ?? []).reduce<ManualOverrideMap>(
    (accumulator, override, index) => {
      accumulator[override.permissionKey] = {
        permissionKey: override.permissionKey,
        effect: override.effect,
        limits: null,
        reason: "preview override",
        createdAt: new Date(1000 + index),
        createdByIdentityId: "preview",
      };

      return accumulator;
    },
    {},
  );
}

function mergeRiskSignals(
  implicitSignals: RiskSignalRecord[],
  explicitSignals: RiskSignalRecord[],
): RiskSignalRecord[] {
  const mergedSignals = [...implicitSignals, ...explicitSignals];
  const deduplicatedSignals = new Map<string, RiskSignalRecord>();

  for (const signal of mergedSignals) {
    const existingSignal = deduplicatedSignals.get(signal.signal);

    if (
      !existingSignal ||
      riskSeverityRank(signal.severity) >
        riskSeverityRank(existingSignal.severity)
    ) {
      deduplicatedSignals.set(signal.signal, signal);
    }
  }

  return [...deduplicatedSignals.values()].sort(
    (left, right) =>
      riskSeverityRank(right.severity) - riskSeverityRank(left.severity),
  );
}

function riskSeverityRank(severity: RiskSignalRecord["severity"]): number {
  switch (severity) {
    case "LOW":
      return 0;
    case "MEDIUM":
      return 1;
    case "HIGH":
      return 2;
    case "CRITICAL":
      return 3;
  }

  throw new Error("Unsupported risk severity");
}

function toResolvedPermissionMap(
  permissions: ConnectionPolicyTemplatePermissions,
  trace: PreviewPermissionsWithTrustStateResult["mergeTrace"],
): ResolvedPermissionMap {
  return Object.keys(permissions)
    .sort()
    .reduce<ResolvedPermissionMap>((accumulator, permissionKey) => {
      const typedPermissionKey =
        permissionKey as keyof ConnectionPolicyTemplatePermissions;
      const permissionTraceKey =
        permissionKey as keyof PreviewPermissionsWithTrustStateResult["mergeTrace"];
      const permissionValue = permissions[typedPermissionKey];
      const permissionTrace = trace[permissionTraceKey];

      if (!permissionValue || !permissionTrace) {
        return accumulator;
      }

      accumulator[permissionKey as keyof ResolvedPermissionMap] = {
        effect: permissionValue.effect,
        ...(permissionValue.limits ? { limits: permissionValue.limits } : {}),
        postTrustEffect: permissionTrace.postTrustEffect,
        manualOverrideEffect: permissionTrace.manualOverrideEffect,
        finalEffect: permissionTrace.finalEffect,
        trace: permissionTrace,
      };

      return accumulator;
    }, {});
}

function toConnectionPolicyTemplatePermissions(
  resolvedPermissions: ResolvedPermissionMap,
): ConnectionPolicyTemplatePermissions {
  return Object.keys(
    resolvedPermissions,
  ).reduce<ConnectionPolicyTemplatePermissions>(
    (accumulator, permissionKey) => {
      const typedPermissionKey = permissionKey as keyof ResolvedPermissionMap;
      const resolvedPermission = resolvedPermissions[typedPermissionKey];

      if (!resolvedPermission) {
        return accumulator;
      }

      accumulator[permissionKey as keyof ConnectionPolicyTemplatePermissions] =
        {
          effect: resolvedPermission.effect,
          ...(resolvedPermission.limits
            ? { limits: resolvedPermission.limits }
            : {}),
        };

      return accumulator;
    },
    {} as ConnectionPolicyTemplatePermissions,
  );
}

function sortTraceEntries(
  trace: PreviewPermissionsWithTrustStateResult["mergeTrace"],
) {
  return Object.keys(trace)
    .sort()
    .reduce<PreviewPermissionsWithTrustStateResult["mergeTrace"]>(
      (accumulator, permissionKey) => {
        const typedPermissionKey =
          permissionKey as keyof PreviewPermissionsWithTrustStateResult["mergeTrace"];
        const traceEntry = trace[typedPermissionKey];

        if (traceEntry) {
          accumulator[typedPermissionKey] = traceEntry;
        }

        return accumulator;
      },
      {},
    );
}

function normalizeResolveConnectionPermissionsInput(
  resolveInput: string | ResolveConnectionPermissionsDto,
): ResolveConnectionPermissionsDto {
  return typeof resolveInput === "string"
    ? {
        connectionId: resolveInput,
      }
    : resolveInput;
}

export function buildTemplateUpsertPayload(
  templateDefinition: ConnectionPolicyTemplateSeedDefinition,
) {
  return {
    sourceIdentityType: toNullablePrismaIdentityType(
      templateDefinition.sourceIdentityType,
    ),
    connectionType: toPrismaConnectionType(templateDefinition.connectionType),
    templateKey: templateDefinition.templateKey,
    displayName: templateDefinition.displayName,
    description: templateDefinition.description ?? null,
    policyVersion: templateDefinition.policyVersion,
    permissionsJson: toRequiredJsonInput(templateDefinition.permissions),
    limitsJson: toNullableJsonInput(templateDefinition.limits),
    isSystem: true,
    isActive: templateDefinition.isActive,
  };
}
