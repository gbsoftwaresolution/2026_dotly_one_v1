import { Environment } from "../enums/environment.enum";

export function isProduction(value: string | undefined): boolean {
  return value === Environment.Production;
}
