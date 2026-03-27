import { Module } from "@nestjs/common";

import { UsersModule } from "../users/users.module";
import { PersonasController } from "./personas.controller";
import { PersonasService } from "./personas.service";

@Module({
  imports: [UsersModule],
  controllers: [PersonasController],
  providers: [PersonasService],
  exports: [PersonasService],
})
export class PersonasModule {}
