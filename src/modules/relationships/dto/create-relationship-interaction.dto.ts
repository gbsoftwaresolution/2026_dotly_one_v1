import { IsEnum } from "class-validator";

import { RelationshipInteractionType } from "../relationship-interaction-type.enum";

export class CreateRelationshipInteractionDto {
  @IsEnum(RelationshipInteractionType)
  type!: RelationshipInteractionType;
}