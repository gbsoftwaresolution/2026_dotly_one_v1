import { IsUUID } from "class-validator";

export class ListContentAccessRulesForContentDto {
  @IsUUID()
  contentId!: string;
}
