import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { LifeDocReminderSetting } from "../life-docs.types";

class QuietHoursDto {
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "start must be HH:mm" })
  start?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "end must be HH:mm" })
  end?: string | null;
}

class ReminderChannelsDto {
  @IsBoolean()
  inApp!: boolean;

  @IsOptional()
  @IsBoolean()
  email?: boolean;

  @IsOptional()
  @IsBoolean()
  push?: boolean;
}

export class UpdateLifeDocRemindersDto {
  @IsOptional()
  @IsEnum(LifeDocReminderSetting)
  reminderSetting?: LifeDocReminderSetting;

  // Days before expiry to notify. Example: [90, 30, 7, 0]
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(3650, { each: true })
  reminderCustomDays?: number[] | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => QuietHoursDto)
  quietHours?: QuietHoursDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => ReminderChannelsDto)
  channels?: ReminderChannelsDto;

  @IsOptional()
  @IsBoolean()
  notifySharedMembers?: boolean;
}
