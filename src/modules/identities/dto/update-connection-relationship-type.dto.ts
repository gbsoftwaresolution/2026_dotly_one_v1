import { IsEnum, IsUUID } from "class-validator";

import { RelationshipType } from "../../../common/enums/relationship-type.enum";

export class UpdateConnectionRelationshipTypeDto {
  @IsUUID()
  connectionId!: string;

  @IsEnum(RelationshipType)
  relationshipType!: RelationshipType;
}
