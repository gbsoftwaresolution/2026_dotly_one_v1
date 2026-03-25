import {
  Controller,
  Get,
  Put,
  Query,
  Req,
  Res,
  HttpStatus,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { createHash } from "crypto";
import * as fs from "fs/promises";
import { createReadStream } from "fs";
import * as path from "path";
import { StorageService } from "./storage.service";

@Controller("storage")
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Put("local-upload")
  async localUpload(
    @Query("key") key: string,
    @Query("token") token: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      if (!key || !token) {
        return res.status(HttpStatus.BAD_REQUEST).send("Missing key or token");
      }

      this.storageService.verifyLocalToken({
        token,
        expectedKey: key,
        expectedMethod: "PUT",
      });

      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const body = Buffer.concat(chunks);

      const filePath = this.storageService.getLocalFilePath(key);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, body);

      const etag = createHash("sha256").update(body).digest("hex");
      res.setHeader("ETag", `"${etag}"`);
      return res.status(HttpStatus.OK).send("OK");
    } catch (e: any) {
      return res
        .status(HttpStatus.FORBIDDEN)
        .send(e?.message || "Upload not authorized");
    }
  }

  @Get("local-download")
  async localDownload(
    @Query("key") key: string,
    @Query("token") token: string,
    @Query("filename") filename: string | undefined,
    @Query("contentType") contentType: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      if (!key || !token) {
        return res.status(HttpStatus.BAD_REQUEST).send("Missing key or token");
      }

      this.storageService.verifyLocalToken({
        token,
        expectedKey: key,
        expectedMethod: "GET",
      });

      const filePath = this.storageService.getLocalFilePath(key);
      const stat = await fs.stat(filePath);

      const safeName = String(filename || path.basename(key) || "download")
        .replace(/\s+/g, " ")
        .replace(/[\\/\0<>:"|?*]+/g, "-")
        .replace(/[\r\n]/g, " ")
        .trim()
        .slice(0, 180);

      const disposition = `attachment; filename="${safeName.replace(/["\\]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(safeName)}`;

      res.setHeader("Accept-Ranges", "bytes");

      res.setHeader(
        "Content-Type",
        typeof contentType === "string" && contentType.trim()
          ? contentType
          : "application/octet-stream",
      );
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("Content-Disposition", disposition);

      const totalSize = stat.size;
      const range =
        typeof req.headers.range === "string" ? req.headers.range : undefined;
      if (range && range.startsWith("bytes=")) {
        const m = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!m) {
          return res
            .status(HttpStatus.BAD_REQUEST)
            .send("Invalid Range header");
        }

        const startRaw = m[1];
        const endRaw = m[2];
        let start = startRaw ? Number(startRaw) : NaN;
        let end = endRaw ? Number(endRaw) : NaN;

        if (!Number.isFinite(start) && !Number.isFinite(end)) {
          return res
            .status(HttpStatus.BAD_REQUEST)
            .send("Invalid Range header");
        }

        // Support suffix ranges: bytes=-N
        if (!Number.isFinite(start) && Number.isFinite(end)) {
          const suffix = end;
          start = Math.max(0, totalSize - suffix);
          end = totalSize - 1;
        }

        // Open-ended ranges: bytes=N-
        if (Number.isFinite(start) && !Number.isFinite(end)) {
          end = totalSize - 1;
        }

        start = Math.max(0, Math.floor(start));
        end = Math.min(totalSize - 1, Math.floor(end));

        if (start > end || start >= totalSize) {
          res.status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE);
          res.setHeader("Content-Range", `bytes */${totalSize}`);
          return res.end();
        }

        const length = end - start + 1;
        res.status(HttpStatus.PARTIAL_CONTENT);
        res.setHeader("Content-Range", `bytes ${start}-${end}/${totalSize}`);
        res.setHeader("Content-Length", String(length));

        const stream = createReadStream(filePath, { start, end });
        stream.on("error", () => {
          if (!res.headersSent) {
            res.status(HttpStatus.NOT_FOUND).send("Not found");
          }
        });
        return stream.pipe(res);
      }

      res.setHeader("Content-Length", totalSize.toString());

      const stream = createReadStream(filePath);
      stream.on("error", () => {
        if (!res.headersSent) {
          res.status(HttpStatus.NOT_FOUND).send("Not found");
        }
      });
      return stream.pipe(res);
    } catch (e: any) {
      return res
        .status(HttpStatus.FORBIDDEN)
        .send(e?.message || "Download not authorized");
    }
  }
}
