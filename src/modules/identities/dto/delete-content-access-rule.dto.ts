import { IsUUID } from "class-validator";

export class DeleteContentAccessRuleDto {
  @IsUUID()
  contentId!: string;

  @IsUUID()
  targetIdentityId!: string;
}
