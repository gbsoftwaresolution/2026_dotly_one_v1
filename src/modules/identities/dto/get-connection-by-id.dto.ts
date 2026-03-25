import { IsUUID } from "class-validator";

export class GetConnectionByIdDto {
  @IsUUID()
  connectionId!: string;
}
