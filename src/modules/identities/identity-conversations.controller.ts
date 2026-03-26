import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";

import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";

import { AIEnforcementService } from "./ai-enforcement.service";
import { ActionEnforcementService } from "./action-enforcement.service";
import { CallEnforcementService } from "./call-enforcement.service";
import { CreateConversationDto } from "./dto/create-conversation.dto";
import { GetOrCreateDirectConversationDto } from "./dto/get-or-create-direct-conversation.dto";
import {
  ConversationIdParamDto,
  EnforceAICapabilityRequestDto,
  EnforceActionRequestDto,
  EnforceCallRequestDto,
  IdentityIdParamDto,
  ListConversationsForIdentityQueryDto,
  UpdateConversationStatusRequestDto,
} from "./dto/identity-http-route.dto";
import { IdentitiesService } from "./identities.service";

@UseGuards(JwtAuthGuard)
@Controller()
export class IdentityConversationsController {
  constructor(
    private readonly identitiesService: IdentitiesService,
    private readonly actionEnforcementService: ActionEnforcementService,
    private readonly callEnforcementService: CallEnforcementService,
    private readonly aiEnforcementService: AIEnforcementService,
  ) {}

  @Post("identity-conversations")
  createConversation(@Body() body: CreateConversationDto) {
    return this.identitiesService.createConversation(body);
  }

  @Post("identity-conversations/get-or-create")
  getOrCreateDirectConversation(
    @Body() body: GetOrCreateDirectConversationDto,
  ) {
    return this.identitiesService.getOrCreateDirectConversation(body);
  }

  @Get("identity-conversations/:conversationId")
  getConversationById(@Param() params: ConversationIdParamDto) {
    return this.identitiesService.getConversationById(params);
  }

  @Get("identities/:identityId/conversations")
  listConversationsForIdentity(
    @Param() params: IdentityIdParamDto,
    @Query() query: ListConversationsForIdentityQueryDto,
  ) {
    return this.identitiesService.listConversationsForIdentity({
      identityId: params.identityId,
      status: query.status,
    });
  }

  @Patch("identity-conversations/:conversationId/status")
  updateConversationStatus(
    @Param() params: ConversationIdParamDto,
    @Body() body: UpdateConversationStatusRequestDto,
  ) {
    return this.identitiesService.updateConversationStatus({
      conversationId: params.conversationId,
      status: body.status,
    });
  }

  @Get("identity-conversations/:conversationId/context")
  resolveConversationContext(@Param() params: ConversationIdParamDto) {
    return this.identitiesService.resolveConversationContext({
      conversationId: params.conversationId,
    });
  }

  @Post("identity-conversations/:conversationId/bind-permissions")
  bindResolvedPermissions(@Param() params: ConversationIdParamDto) {
    return this.identitiesService.bindResolvedPermissionsToConversation({
      conversationId: params.conversationId,
    });
  }

  @Get("identity-conversations/:conversationId/binding-staleness")
  getBindingStaleness(@Param() params: ConversationIdParamDto) {
    return this.identitiesService.isConversationPermissionBindingStale(
      params.conversationId,
    );
  }

  @Get("identity-conversations/:conversationId/explain-context")
  explainConversationContext(@Param() params: ConversationIdParamDto) {
    return this.identitiesService.explainConversationPermissionContext({
      conversationId: params.conversationId,
    });
  }

  @Post("identity-conversations/:conversationId/enforce-action")
  enforceAction(
    @Param() params: ConversationIdParamDto,
    @Body() body: EnforceActionRequestDto,
  ) {
    return this.actionEnforcementService.enforceAction({
      conversationId: params.conversationId,
      actorIdentityId: body.actorIdentityId,
      actionType: body.actionType,
      contentId: body.contentId,
      currentViewCount: body.currentViewCount,
      metadata: body.metadata,
    });
  }

  @Post("identity-conversations/:conversationId/enforce-call")
  enforceCall(
    @Param() params: ConversationIdParamDto,
    @Body() body: EnforceCallRequestDto,
  ) {
    return this.callEnforcementService.enforceCall({
      conversationId: params.conversationId,
      actorIdentityId: body.actorIdentityId,
      callType: body.callType,
      initiationMode: body.initiationMode,
      screenCaptureDetected: body.screenCaptureDetected,
      castingDetected: body.castingDetected,
      deviceIntegrityCompromised: body.deviceIntegrityCompromised,
      currentProtectedModeExpectation: body.currentProtectedModeExpectation,
      metadata: body.metadata,
    });
  }

  @Post("identity-conversations/:conversationId/enforce-ai")
  enforceAICapability(
    @Param() params: ConversationIdParamDto,
    @Body() body: EnforceAICapabilityRequestDto,
  ) {
    return this.aiEnforcementService.enforceAICapability({
      conversationId: params.conversationId,
      actorIdentityId: body.actorIdentityId,
      capability: body.capability,
      contextType: body.contextType,
      contentId: body.contentId,
      isProtectedContent: body.isProtectedContent,
      isVaultContent: body.isVaultContent,
      previewRiskSignals: body.previewRiskSignals,
    });
  }
}
