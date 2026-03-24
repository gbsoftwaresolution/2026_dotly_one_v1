import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../generated/prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(configService: ConfigService) {
    const connectionString = configService.get<string>("database.url");

    super({
      adapter: new PrismaPg({
        connectionString,
      }),
    });
  }

  async connect(): Promise<void> {
    await this.$connect();
  }

  async tableExists(tableName: string): Promise<boolean> {
    const rows = await this.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = current_schema()
          AND table_name = ${tableName}
      ) AS "exists"
    `;

    return rows[0]?.exists ?? false;
  }

  async getAppliedMigrationNames(): Promise<string[]> {
    if (!(await this.tableExists("_prisma_migrations"))) {
      return [];
    }

    const rows = await this.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name
      FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL
        AND rolled_back_at IS NULL
      ORDER BY migration_name
    `;

    return rows.map((row) => row.migration_name);
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
