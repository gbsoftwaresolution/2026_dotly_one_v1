import { IsEnum } from "class-validator";
import { LifeDocRenewalState } from "../life-docs.types";

export class SetLifeDocRenewalStateDto {
  @IsEnum(LifeDocRenewalState)
  state!: LifeDocRenewalState;
}
