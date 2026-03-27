import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";

import { CreateConnectionDto } from "./dto/create-connection.dto";
import { CreateIdentityDto } from "./dto/create-identity.dto";
import {
  ConnectionIdParamDto,
  ConnectionPermissionKeyParamDto,
  CreateIdentityMemberRequestDto,
  CreateIdentityOperatorRequestDto,
  DiffCurrentPermissionsAgainstSnapshotQueryDto,
  ExplainResolvedPermissionQueryDto,
  ExplainResolvedPermissionsQueryDto,
  IdentityIdParamDto,
  IdentityMemberIdParamDto,
  IdentityOperatorIdParamDto,
  ListConnectionsForIdentityQueryDto,
  SetPermissionOverrideRequestDto,
  UpdateIdentityMemberRequestDto,
  UpdateIdentityOperatorRequestDto,
  UpdatePersonaAssignmentsRequestDto,
  UpdateConnectionRelationshipTypeRequestDto,
  UpdateConnectionTypeRequestDto,
  UpdateTrustStateRequestDto,
} from "./dto/identity-http-route.dto";
import { IdentitiesService } from "./identities.service";

@UseGuards(JwtAuthGuard)
@Controller()
export class IdentitiesController {
  constructor(private readonly identitiesService: IdentitiesService) {}

  @Get("identities")
  listMyIdentities(@CurrentUser() user: AuthenticatedUser) {
    return this.identitiesService.listIdentitiesForUser(user.id);
  }

  @Post("identities")
  createIdentity(@Body() body: CreateIdentityDto) {
    return this.identitiesService.createIdentity(body);
  }

  @Post("identity-connections")
  createConnection(@Body() body: CreateConnectionDto) {
    return this.identitiesService.createConnection(body);
  }

  @Get("identity-connections/:connectionId")
  getConnectionById(@Param() params: ConnectionIdParamDto) {
    return this.identitiesService.getConnectionById(params);
  }

  @Get("identities/:identityId/connections")
  listConnectionsForIdentity(
    @Param() params: IdentityIdParamDto,
    @Query() query: ListConnectionsForIdentityQueryDto,
  ) {
    return this.identitiesService.listConnectionsForIdentity({
      identityId: params.identityId,
      status: query.status,
    });
  }

  @Get("identities/:identityId/team-access")
  getIdentityTeamAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: IdentityIdParamDto,
  ) {
    return this.identitiesService.getIdentityTeamPersonaAccess(
      user.id,
      params.identityId,
    );
  }

  @Get("identities/:identityId/members")
  listIdentityMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: IdentityIdParamDto,
  ) {
    return this.identitiesService.listIdentityMembers(
      user.id,
      params.identityId,
    );
  }

  @Post("identities/:identityId/members")
  createIdentityMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: IdentityIdParamDto,
    @Body() body: CreateIdentityMemberRequestDto,
  ) {
    return this.identitiesService.createIdentityMember(user.id, {
      identityId: params.identityId,
      personId: body.personId,
      role: body.role,
      status: body.status,
      personaIds: body.personaIds,
    });
  }

  @Patch("identities/:identityId/members/:memberId")
  updateIdentityMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: IdentityMemberIdParamDto,
    @Body() body: UpdateIdentityMemberRequestDto,
  ) {
    return this.identitiesService.updateIdentityMember(user.id, {
      identityId: params.identityId,
      memberId: params.memberId,
      role: body.role,
      status: body.status,
    });
  }

  @Delete("identities/:identityId/members/:memberId")
  removeIdentityMemberAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: IdentityMemberIdParamDto,
  ) {
    return this.identitiesService.removeIdentityMemberAccess(user.id, {
      identityId: params.identityId,
      memberId: params.memberId,
    });
  }

  @Get("identities/:identityId/operators")
  listIdentityOperators(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: IdentityIdParamDto,
  ) {
    return this.identitiesService.listIdentityOperators(
      user.id,
      params.identityId,
    );
  }

  @Post("identities/:identityId/operators")
  createIdentityOperator(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: IdentityIdParamDto,
    @Body() body: CreateIdentityOperatorRequestDto,
  ) {
    return this.identitiesService.createIdentityOperator(user.id, {
      identityId: params.identityId,
      personId: body.personId,
      role: body.role,
      status: body.status,
      personaIds: body.personaIds,
    });
  }

  @Patch("identities/:identityId/operators/:operatorId")
  updateIdentityOperator(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: IdentityOperatorIdParamDto,
    @Body() body: UpdateIdentityOperatorRequestDto,
  ) {
    return this.identitiesService.updateIdentityOperator(user.id, {
      identityId: params.identityId,
      operatorId: params.operatorId,
      role: body.role,
      status: body.status,
    });
  }

  @Delete("identities/:identityId/operators/:operatorId")
  revokeIdentityOperatorAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: IdentityOperatorIdParamDto,
  ) {
    return this.identitiesService.revokeIdentityOperatorAccess(user.id, {
      identityId: params.identityId,
      operatorId: params.operatorId,
    });
  }

  @Put("identities/:identityId/members/:memberId/persona-assignments")
  updateIdentityMemberPersonaAssignments(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: IdentityMemberIdParamDto,
    @Body() body: UpdatePersonaAssignmentsRequestDto,
  ) {
    return this.identitiesService.updateIdentityMemberPersonaAssignments(
      user.id,
      {
        identityId: params.identityId,
        memberId: params.memberId,
        personaIds: body.personaIds,
      },
    );
  }

  @Put("identities/:identityId/operators/:operatorId/persona-assignments")
  updateIdentityOperatorPersonaAssignments(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: IdentityOperatorIdParamDto,
    @Body() body: UpdatePersonaAssignmentsRequestDto,
  ) {
    return this.identitiesService.updateIdentityOperatorPersonaAssignments(
      user.id,
      {
        identityId: params.identityId,
        operatorId: params.operatorId,
        personaIds: body.personaIds,
      },
    );
  }

  @Patch("identity-connections/:connectionId/type")
  updateConnectionType(
    @Param() params: ConnectionIdParamDto,
    @Body() body: UpdateConnectionTypeRequestDto,
  ) {
    return this.identitiesService.updateConnectionType({
      connectionId: params.connectionId,
      connectionType: body.connectionType,
    });
  }

  @Patch("identity-connections/:connectionId/trust-state")
  updateTrustState(
    @Param() params: ConnectionIdParamDto,
    @Body() body: UpdateTrustStateRequestDto,
  ) {
    return this.identitiesService.updateTrustState({
      connectionId: params.connectionId,
      trustState: body.trustState,
    });
  }

  @Patch("identity-connections/:connectionId/relationship-type")
  updateConnectionRelationshipType(
    @Param() params: ConnectionIdParamDto,
    @Body() body: UpdateConnectionRelationshipTypeRequestDto,
  ) {
    return this.identitiesService.updateConnectionRelationshipType({
      connectionId: params.connectionId,
      relationshipType: body.relationshipType,
    });
  }

  @Put("identity-connections/:connectionId/permission-overrides/:permissionKey")
  setPermissionOverride(
    @Param() params: ConnectionPermissionKeyParamDto,
    @Body() body: SetPermissionOverrideRequestDto,
  ) {
    return this.identitiesService.setPermissionOverride({
      connectionId: params.connectionId,
      permissionKey: params.permissionKey,
      effect: body.effect,
      limitsJson: body.limitsJson,
      reason: body.reason,
      createdByIdentityId: body.createdByIdentityId,
    });
  }

  @Get("identity-connections/:connectionId/permission-overrides")
  listPermissionOverrides(@Param() params: ConnectionIdParamDto) {
    return this.identitiesService.listPermissionOverridesForConnection({
      connectionId: params.connectionId,
    });
  }

  @Get("identity-connections/:connectionId/resolved-permissions")
  resolveConnectionPermissions(
    @Param() params: ConnectionIdParamDto,
    @Query() query: ExplainResolvedPermissionsQueryDto,
  ) {
    return this.identitiesService.resolveConnectionPermissions({
      connectionId: params.connectionId,
      persistSnapshot: query.persistSnapshot,
      preferCache: query.preferCache,
      preferSnapshot: query.preferSnapshot,
      forceRefresh: query.forceRefresh,
      applyRiskOverlay: query.applyRiskOverlay,
    });
  }

  @Get("identity-connections/:connectionId/permissions/:permissionKey/explain")
  explainResolvedPermission(
    @Param() params: ConnectionPermissionKeyParamDto,
    @Query() query: ExplainResolvedPermissionQueryDto,
  ) {
    return this.identitiesService.explainResolvedPermission({
      connectionId: params.connectionId,
      permissionKey: params.permissionKey,
      applyRiskOverlay: query.applyRiskOverlay,
      forceRefresh: query.forceRefresh,
      verbosity: query.verbosity,
    });
  }

  @Get("identity-connections/:connectionId/permissions/explain")
  explainResolvedPermissions(
    @Param() params: ConnectionIdParamDto,
    @Query() query: ExplainResolvedPermissionsQueryDto,
  ) {
    return this.identitiesService.explainResolvedPermissions({
      connectionId: params.connectionId,
      applyRiskOverlay: query.applyRiskOverlay,
      forceRefresh: query.forceRefresh,
      preferCache: query.preferCache,
      preferSnapshot: query.preferSnapshot,
      verbosity: query.verbosity,
    });
  }

  @Get("identity-connections/:connectionId/permissions/diff-against-snapshot")
  diffCurrentPermissionsAgainstSnapshot(
    @Param() params: ConnectionIdParamDto,
    @Query() query: DiffCurrentPermissionsAgainstSnapshotQueryDto,
  ) {
    return this.identitiesService.diffCurrentPermissionsAgainstSnapshot({
      connectionId: params.connectionId,
      applyRiskOverlay: query.applyRiskOverlay,
      forceRefresh: query.forceRefresh,
    });
  }
}
