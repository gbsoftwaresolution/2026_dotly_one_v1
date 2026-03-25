import { IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateShareDto } from './create-share.dto';

export class CreateShareStubRequestDto {
  @IsObject()
  @ValidateNested()
  @Type(() => CreateShareDto)
  createShareDto!: CreateShareDto;
}
