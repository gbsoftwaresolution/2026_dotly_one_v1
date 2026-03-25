import { IsInt, IsOptional, Min, Max } from 'class-validator';

export class CreateShareDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  expiresInDays?: number = 7;
}