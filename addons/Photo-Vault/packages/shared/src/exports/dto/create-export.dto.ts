import { Type } from 'class-transformer';
import {
  IsEnum,
  IsUUID,
  IsDate,
  ValidateIf,
  IsNotEmpty,
} from 'class-validator';
import { ExportScopeType } from '../export.types';

export class CreateExportDto {
  @IsEnum(ExportScopeType)
  scopeType!: ExportScopeType;

  @ValidateIf((o) => o.scopeType === ExportScopeType.ALBUM)
  @IsUUID()
  @IsNotEmpty()
  scopeAlbumId?: string;

  @ValidateIf((o) => o.scopeType === ExportScopeType.DATE_RANGE)
  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  scopeFrom?: Date;

  @ValidateIf((o) => o.scopeType === ExportScopeType.DATE_RANGE)
  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  scopeTo?: Date;
}
