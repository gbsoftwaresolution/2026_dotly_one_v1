import { IsString } from 'class-validator';

export class ShareAccessTokenDto {
  @IsString()
  token!: string;
}