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
import { TrustState } from "../../common/enums/trust-state.enum";
import { PrismaService } from "../../infrastructure/database/prisma.service";

import { CreateConnectionDto } from "./dto/create-connection.dto";
import { CreateIdentityDto } from "./dto/create-identity.dto";
import { GetConnectionByIdDto } from "./dto/get-connection-by-id.dto";
import { GetConnectionPolicyTemplateDto } from "./dto/get-connection-policy-template.dto";
import { ListConnectionsForIdentityDto } from "./dto/list-connections-for-identity.dto";
import { PreviewPermissionsWithTrustStateDto } from "./dto/preview-permissions-with-trust-state.dto";
import { SetPermissionOverrideDto } from "./dto/set-permission-override.dto";
import { UpdateConnectionStatusDto } from "./dto/update-connection-status.dto";
import { UpdateConnectionTypeDto } from "./dto/update-connection-type.dto";
import { UpdateTrustStateDto } from "./dto/update-trust-state.dto";
import type {
  ConnectionPolicyTemplateLimits,
  ConnectionPolicyTemplatePermissions,
  ConnectionPolicyTemplateRecord,
  ConnectionPolicyTemplateSeedDefinition,
  PreviewPermissionsWithTrustStateResult,
  TrustStateAdjustmentDefinition,
} from "./identity.types";
import {
  applyTrustStateAdjustment,
  getTrustStateAdjustment as getTrustStateAdjustmentDefinition,
} from "./permission-merge";
import {
  CONNECTION_POLICY_TEMPLATE_SEEDS,
  validateTemplatePermissions,
} from "./policy-template-seeds";

const identityConnectionSelect = {
  id: true,
  sourceIdentityId: true,
  targetIdentityId: true,
  connectionType: true,
  trustState: true,
  status: true,
  createdByIdentityId: true,
  note: true,
  metadataJson: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.IdentityConnectionSelect;

type IdentityConnectionRecord = Prisma.IdentityConnectionGetPayload<{
  select: typeof identityConnectionSelect;
}>;

@Injectable()
export class IdentitiesService {
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

    return this.prismaService.identityConnection.update({
      where: {
        id: updateConnectionTypeDto.connectionId,
      },
      data: {
        connectionType: toPrismaConnectionType(
          updateConnectionTypeDto.connectionType,
        ),
        status: toPrismaConnectionStatus(nextStatus),
      },
      select: identityConnectionSelect,
    });
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

    return this.prismaService.identityConnection.update({
      where: {
        id: updateTrustStateDto.connectionId,
      },
      data: {
        trustState: toPrismaTrustState(updateTrustStateDto.trustState),
        status: toPrismaConnectionStatus(nextStatus),
      },
      select: identityConnectionSelect,
    });
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

    return this.prismaService.connectionPermissionOverride.upsert({
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
