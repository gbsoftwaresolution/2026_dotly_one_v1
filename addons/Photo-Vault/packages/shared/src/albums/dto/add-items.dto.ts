import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class AddItemsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  mediaIds!: string[];
}
