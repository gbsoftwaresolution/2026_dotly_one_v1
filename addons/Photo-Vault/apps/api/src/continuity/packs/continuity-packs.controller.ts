import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Request } from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { ContinuityPacksService } from "./continuity-packs.service";

@Controller("continuity/packs")
@UseGuards(JwtAuthGuard)
export class ContinuityPacksController {
  constructor(private readonly packsService: ContinuityPacksService) {}

  @Post()
  create(@Request() req, @Body() createPackDto: any) {
    return this.packsService.create(req.user.id, createPackDto);
  }

  @Get()
  findAll(@Request() req) {
    return this.packsService.findAll(req.user.id);
  }

  @Get(":id")
  findOne(@Request() req, @Param("id") id: string) {
    return this.packsService.findOne(req.user.id, id);
  }

  @Put(":id")
  update(@Request() req, @Param("id") id: string, @Body() updatePackDto: any) {
      return this.packsService.update(req.user.id, id, updatePackDto);
  }

  @Delete(":id")
  remove(@Request() req, @Param("id") id: string) {
      return this.packsService.remove(req.user.id, id);
  }

  @Post(":id/arm")
  arm(@Request() req, @Param("id") id: string) {
      return this.packsService.arm(req.user.id, id);
  }

  @Post(":id/items")
  addItem(@Request() req, @Param("id") id: string, @Body() body: { lifeDocId: string }) {
    return this.packsService.addItem(req.user.id, id, body.lifeDocId);
  }

  @Delete(":id/items/:itemId")
  removeItem(@Request() req, @Param("id") id: string, @Param("itemId") itemId: string) {
    return this.packsService.removeItem(req.user.id, id, itemId);
  }

  @Post(":id/recipients")
  addRecipient(@Request() req, @Param("id") id: string, @Body() body: { recipientId: string, role: string }) {
    return this.packsService.addRecipient(req.user.id, id, body.recipientId, body.role);
  }

  @Delete(":id/recipients/:recipientId")
  removeRecipient(@Request() req, @Param("id") id: string, @Param("recipientId") recipientId: string) {
    return this.packsService.removeRecipient(req.user.id, id, recipientId);
  }
}
