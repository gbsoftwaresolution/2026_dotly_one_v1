import { Module } from "@nestjs/common";
import { AppModule } from "./app.module";
import { WorkersModule } from "./workers/workers.module";

@Module({
  imports: [AppModule, WorkersModule],
})
export class WorkerAppModule {}
