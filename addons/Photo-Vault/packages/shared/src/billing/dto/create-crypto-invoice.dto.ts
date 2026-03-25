import { IsEnum } from 'class-validator';
import type { ExposedPlanCode } from '../billing.types';

export class CreateCryptoInvoiceDto {
  @IsEnum(['P6M_25', 'Y1_100', 'Y1_199'] as const)
  planCode!: ExposedPlanCode;
}
