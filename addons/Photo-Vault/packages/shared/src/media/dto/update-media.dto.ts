import { Type } from 'class-transformer';
import { IsOptional, IsString, IsDate } from 'class-validator';

export class UpdateMediaDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  takenAt?: Date;

  @IsOptional()
  @IsString()
  locationText?: string;
}