import { IsUUID } from "class-validator";

export class GetContentAccessRuleDto {
  @IsUUID()
  contentId!: string;

  @IsUUID()
  targetIdentityId!: string;
}
