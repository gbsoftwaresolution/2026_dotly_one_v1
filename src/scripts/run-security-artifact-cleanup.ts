import { NestFactory } from "@nestjs/core";

import { AppModule } from "../app.module";
import { SecurityArtifactLifecycleService } from "../modules/auth/security-artifact-lifecycle.service";

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const cleanupService = app.get(SecurityArtifactLifecycleService);
    await cleanupService.cleanupArtifacts({ trigger: "manual" });
  } finally {
    await app.close();
  }
}

void main();