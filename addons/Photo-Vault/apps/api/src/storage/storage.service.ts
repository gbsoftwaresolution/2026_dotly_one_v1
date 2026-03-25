import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "crypto";
import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as path from "path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  ListPartsCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Upload } from "@aws-sdk/lib-storage";
import { Readable, Transform } from "stream";
import { pipeline } from "stream/promises";
import { ConfigService } from "../config/config.service";

export interface SignedUploadUrl {
  url: string;
  headers: Record<string, string>;
  expiresAt: Date;
  method: "PUT";
}

export interface SignedDownloadUrl {
  url: string;
  headers: Record<string, string>;
  expiresAt: Date;
  method: "GET";
}

export interface SignedDownloadUrlOptions {
  /** Suggested filename presented to the user agent (download name). */
  filename?: string;
  /** Optional content-type override (mostly useful for local driver). */
  contentType?: string;
  /** Content disposition type. Defaults to attachment when filename is provided. */
  disposition?: "attachment" | "inline";
}

export interface MultipartUploadedPart {
  partNumber: number;
  etag: string;
  size?: number;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client | null = null;
  private driver: "s3" | "local" | "none" = "none";

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.initializeDriver();
  }

  private initializeDriver(): void {
    const requested = this.configService.storageDriver;

    if (requested === "local") {
      if (this.configService.nodeEnv === "production") {
        this.logger.warn(
          "STORAGE_DRIVER=local is not allowed in production. StorageService will operate in no-op mode.",
        );
        this.driver = "none";
        return;
      }
      this.driver = "local";
      this.logger.warn(
        "StorageService using LOCAL filesystem driver (development mode).",
      );
      return;
    }

    // Auto or S3: try to initialize S3 if configured
    const accessKeyId = this.configService.s3AccessKeyId;
    const secretAccessKey = this.configService.s3SecretAccessKey;
    const region = this.configService.s3Region;
    const endpoint = this.configService.s3Endpoint;
    const forcePathStyle = this.configService.s3ForcePathStyle;

    if (!accessKeyId || !secretAccessKey) {
      if (requested === "s3") {
        this.logger.warn(
          "STORAGE_DRIVER=s3 but S3 credentials are missing. StorageService will operate in no-op mode.",
        );
        this.driver = "none";
        return;
      }

      if (this.configService.nodeEnv !== "production") {
        this.driver = "local";
        this.logger.warn(
          "S3 not configured. Falling back to LOCAL filesystem driver (development mode).",
        );
        return;
      }

      this.logger.warn(
        "S3 credentials not configured. StorageService will operate in no-op mode.",
      );
      this.driver = "none";
      return;
    }

    const config: any = {
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle,
      // Timeout configuration (milliseconds)
      requestTimeout: this.configService.s3OperationTimeout * 1000,
      // Retry configuration
      maxAttempts: 3,
      retryMode: "standard",
    };

    if (endpoint) {
      config.endpoint = endpoint;
    }

    this.s3Client = new S3Client(config);
    this.driver = "s3";
    this.logger.log(
      `S3 client initialized with ${this.configService.s3OperationTimeout}s timeout and retry enabled`,
    );
  }

  private localRootDir(): string {
    return path.resolve(process.cwd(), this.configService.storageLocalDir);
  }

  private safeLocalPathForKey(objectKey: string): string {
    // Normalize using posix semantics because object keys use '/'
    const normalized = path.posix.normalize(objectKey).replace(/^\/+/, "");
    if (
      normalized.startsWith("..") ||
      normalized.includes(".." + path.posix.sep)
    ) {
      throw new Error("Invalid object key");
    }

    const root = this.localRootDir();
    const full = path.resolve(root, normalized);
    if (!full.startsWith(root + path.sep) && full !== root) {
      throw new Error("Invalid object key");
    }
    return full;
  }

  private async ensureLocalDirForKey(objectKey: string): Promise<void> {
    const full = this.safeLocalPathForKey(objectKey);
    await fs.mkdir(path.dirname(full), { recursive: true });
  }

  private createByteCounter(): { counter: Transform; getBytes: () => number } {
    let bytes = 0;
    const counter = new Transform({
      transform(chunk, _encoding, callback) {
        bytes += Buffer.byteLength(chunk);
        callback(null, chunk);
      },
    });
    return { counter, getBytes: () => bytes };
  }

  /**
   * Get object as a Node.js Readable stream (ciphertext bytes).
   * Intended for server-side background jobs only.
   */
  async getObjectStream(objectKey: string): Promise<Readable> {
    if (this.driver === "local") {
      const full = this.safeLocalPathForKey(objectKey);
      return fsSync.createReadStream(full);
    }

    if (!this.s3Client || this.driver !== "s3") {
      throw new Error("S3 storage is not configured");
    }

    const bucket = this.configService.s3Bucket;
    const command = new GetObjectCommand({ Bucket: bucket, Key: objectKey });
    const result = await this.s3Client.send(command);
    const body: any = result.Body;
    if (!body) {
      throw new Error("Storage object body is empty");
    }

    // In Node.js, AWS SDK v3 returns a Readable stream for Body.
    if (typeof body.pipe === "function") {
      return body as Readable;
    }

    // Fallback: convert Uint8Array/Buffer-like to stream
    return Readable.from(body as any);
  }

  /**
   * Upload an object from a Readable stream. Returns the number of bytes streamed.
   * Intended for server-side background jobs only.
   */
  async putObjectStream(args: {
    objectKey: string;
    contentType: string;
    body: Readable;
  }): Promise<{ byteSize: number }> {
    const { objectKey, contentType, body } = args;
    const { counter, getBytes } = this.createByteCounter();

    if (this.driver === "local") {
      await this.ensureLocalDirForKey(objectKey);
      const full = this.safeLocalPathForKey(objectKey);
      const out = fsSync.createWriteStream(full);
      await pipeline(body, counter, out);
      return { byteSize: getBytes() };
    }

    if (!this.s3Client || this.driver !== "s3") {
      throw new Error("S3 storage is not configured");
    }

    const bucket = this.configService.s3Bucket;

    // Multipart upload for unknown-length streams.
    const upload = new Upload({
      client: this.s3Client,
      params: {
        Bucket: bucket,
        Key: objectKey,
        Body: body.pipe(counter),
        ContentType: contentType,
      },
    });

    await upload.done();
    this.logger.debug(`Uploaded object: ${objectKey}`);
    return { byteSize: getBytes() };
  }

  private makeLocalToken(payload: {
    key: string;
    exp: number;
    method: "PUT" | "GET";
  }): string {
    const payloadJson = JSON.stringify(payload);
    const payloadB64 = Buffer.from(payloadJson, "utf8").toString("base64url");
    const sig = createHmac("sha256", this.configService.jwtSecret)
      .update(payloadB64)
      .digest("base64url");
    return `${payloadB64}.${sig}`;
  }

  verifyLocalToken(args: {
    token: string;
    expectedKey: string;
    expectedMethod: "PUT" | "GET";
  }): void {
    const [payloadB64, sig] = (args.token || "").split(".");
    if (!payloadB64 || !sig) {
      throw new Error("Invalid token");
    }

    const expectedSig = createHmac("sha256", this.configService.jwtSecret)
      .update(payloadB64)
      .digest("base64url");

    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error("Invalid token");
    }

    let payload: any;
    try {
      payload = JSON.parse(
        Buffer.from(payloadB64, "base64url").toString("utf8"),
      );
    } catch {
      throw new Error("Invalid token");
    }

    if (!payload || typeof payload !== "object")
      throw new Error("Invalid token");
    if (payload.key !== args.expectedKey) throw new Error("Invalid token");
    if (payload.method !== args.expectedMethod)
      throw new Error("Invalid token");
    if (typeof payload.exp !== "number" || Date.now() > payload.exp)
      throw new Error("Token expired");
  }

  getLocalFilePath(objectKey: string): string {
    return this.safeLocalPathForKey(objectKey);
  }

  /**
   * Check if S3 is configured and available
   */
  isAvailable(): boolean {
    return this.driver === "s3" || this.driver === "local";
  }

  supportsMultipartUpload(): boolean {
    return this.driver === "s3";
  }

  /**
   * Create a signed URL for uploading an object
   */
  async createSignedUploadUrl(
    objectKey: string,
    contentType: string,
    byteSize?: number,
  ): Promise<SignedUploadUrl> {
    if (this.driver === "local") {
      const expiresIn = this.configService.signedUrlTtlSeconds;
      const expiresAt = new Date(Date.now() + expiresIn * 1000);
      const token = this.makeLocalToken({
        key: objectKey,
        method: "PUT",
        exp: expiresAt.getTime(),
      });

      const url = `${this.configService.apiOrigin}/v1/storage/local-upload?key=${encodeURIComponent(objectKey)}&token=${encodeURIComponent(token)}`;
      const headers: Record<string, string> = {
        "Content-Type": contentType,
      };

      return { url, headers, expiresAt, method: "PUT" };
    }

    if (!this.s3Client || this.driver !== "s3") {
      throw new Error("S3 storage is not configured");
    }

    const bucket = this.configService.s3Bucket;
    const expiresIn = this.configService.signedUrlTtlSeconds;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: contentType,
      ...(byteSize !== undefined && { ContentLength: byteSize }),
    });

    const url = await getSignedUrl(this.s3Client, command, { expiresIn });

    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // Additional headers that should be sent with the PUT request
    const headers: Record<string, string> = {
      "Content-Type": contentType,
    };

    return {
      url,
      headers,
      expiresAt,
      method: "PUT",
    };
  }

  /**
   * Create a signed URL for downloading an object
   */
  async createSignedDownloadUrl(
    objectKey: string,
    options: SignedDownloadUrlOptions = {},
  ): Promise<SignedDownloadUrl> {
    if (this.driver === "local") {
      const expiresIn = this.configService.signedUrlTtlSeconds;
      const expiresAt = new Date(Date.now() + expiresIn * 1000);
      const token = this.makeLocalToken({
        key: objectKey,
        method: "GET",
        exp: expiresAt.getTime(),
      });

      const filename = options.filename;
      const contentType = options.contentType;

      const url =
        `${this.configService.apiOrigin}/v1/storage/local-download` +
        `?key=${encodeURIComponent(objectKey)}` +
        `&token=${encodeURIComponent(token)}` +
        (filename ? `&filename=${encodeURIComponent(filename)}` : "") +
        (contentType ? `&contentType=${encodeURIComponent(contentType)}` : "");

      return {
        url,
        headers: {},
        expiresAt,
        method: "GET",
      };
    }

    if (!this.s3Client || this.driver !== "s3") {
      throw new Error("S3 storage is not configured");
    }

    const bucket = this.configService.s3Bucket;
    const expiresIn = this.configService.signedUrlTtlSeconds;

    const responseContentDisposition = options.filename
      ? this.buildContentDisposition(
          options.disposition ?? "attachment",
          options.filename,
        )
      : undefined;

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ...(responseContentDisposition
        ? { ResponseContentDisposition: responseContentDisposition }
        : {}),
      ...(options.contentType
        ? { ResponseContentType: options.contentType }
        : {}),
    });

    const url = await getSignedUrl(this.s3Client, command, { expiresIn });

    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    return {
      url,
      headers: {},
      expiresAt,
      method: "GET",
    };
  }

  private buildContentDisposition(
    disposition: "attachment" | "inline",
    filename: string,
  ): string {
    // RFC 6266. Provide a conservative ASCII fallback and a UTF-8 filename*.
    const trimmed = String(filename || "download").trim() || "download";
    const asciiFallback = trimmed
      .replace(/[^\x20-\x7E]+/g, "_")
      .replace(/["\\]/g, "_")
      .replace(/[\r\n]/g, "_")
      .slice(0, 180);

    const encoded = encodeURIComponent(trimmed)
      .replace(/%28/g, "(")
      .replace(/%29/g, ")")
      .replace(/%27/g, "'");

    return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
  }

  async createMultipartUpload(args: {
    objectKey: string;
    contentType: string;
  }): Promise<{ uploadId: string }> {
    if (this.driver === "local") {
      throw new Error(
        "Multipart upload is not supported with the local storage driver",
      );
    }

    if (!this.s3Client || this.driver !== "s3") {
      throw new Error("S3 storage is not configured");
    }

    const bucket = this.configService.s3Bucket;
    const command = new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: args.objectKey,
      ContentType: args.contentType,
    });
    const result = await this.s3Client.send(command);
    if (!result.UploadId) {
      throw new Error("Failed to create multipart upload");
    }
    return { uploadId: result.UploadId };
  }

  async createSignedUploadPartUrl(args: {
    objectKey: string;
    uploadId: string;
    partNumber: number;
  }): Promise<SignedUploadUrl> {
    if (this.driver === "local") {
      throw new Error(
        "Multipart upload is not supported with the local storage driver",
      );
    }

    if (!this.s3Client || this.driver !== "s3") {
      throw new Error("S3 storage is not configured");
    }

    const bucket = this.configService.s3Bucket;
    const expiresIn = this.configService.signedUrlTtlSeconds;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    const command = new UploadPartCommand({
      Bucket: bucket,
      Key: args.objectKey,
      UploadId: args.uploadId,
      PartNumber: args.partNumber,
    });

    const url = await getSignedUrl(this.s3Client, command, { expiresIn });

    return {
      url,
      headers: {},
      expiresAt,
      method: "PUT",
    };
  }

  async listMultipartParts(args: {
    objectKey: string;
    uploadId: string;
  }): Promise<{ parts: MultipartUploadedPart[] }> {
    if (this.driver === "local") {
      throw new Error(
        "Multipart upload is not supported with the local storage driver",
      );
    }

    if (!this.s3Client || this.driver !== "s3") {
      throw new Error("S3 storage is not configured");
    }

    const bucket = this.configService.s3Bucket;
    const command = new ListPartsCommand({
      Bucket: bucket,
      Key: args.objectKey,
      UploadId: args.uploadId,
    });

    const result = await this.s3Client.send(command);
    const parts: MultipartUploadedPart[] = (result.Parts || [])
      .filter(
        (p) => typeof p.PartNumber === "number" && typeof p.ETag === "string",
      )
      .map((p) => ({
        partNumber: p.PartNumber!,
        etag: p.ETag!,
        size: typeof p.Size === "number" ? p.Size : undefined,
      }));

    return { parts };
  }

  async completeMultipartUpload(args: {
    objectKey: string;
    uploadId: string;
    parts: Array<{ partNumber: number; etag: string }>;
  }): Promise<{ etag?: string }> {
    if (this.driver === "local") {
      throw new Error(
        "Multipart upload is not supported with the local storage driver",
      );
    }

    if (!this.s3Client || this.driver !== "s3") {
      throw new Error("S3 storage is not configured");
    }

    const bucket = this.configService.s3Bucket;
    const command = new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: args.objectKey,
      UploadId: args.uploadId,
      MultipartUpload: {
        Parts: args.parts.map((p) => ({
          PartNumber: p.partNumber,
          ETag: p.etag,
        })),
      },
    });

    const result = await this.s3Client.send(command);
    return { etag: typeof result.ETag === "string" ? result.ETag : undefined };
  }

  async abortMultipartUpload(args: {
    objectKey: string;
    uploadId: string;
  }): Promise<void> {
    if (this.driver === "local") {
      throw new Error(
        "Multipart upload is not supported with the local storage driver",
      );
    }

    if (!this.s3Client || this.driver !== "s3") {
      throw new Error("S3 storage is not configured");
    }

    const bucket = this.configService.s3Bucket;
    const command = new AbortMultipartUploadCommand({
      Bucket: bucket,
      Key: args.objectKey,
      UploadId: args.uploadId,
    });
    await this.s3Client.send(command);
  }

  /**
   * Delete an object from storage
   */
  async deleteObject(objectKey: string): Promise<void> {
    if (this.driver === "local") {
      const full = this.safeLocalPathForKey(objectKey);
      await fs.rm(full, { force: true });
      return;
    }

    if (!this.s3Client || this.driver !== "s3") {
      throw new Error("S3 storage is not configured");
    }

    const bucket = this.configService.s3Bucket;

    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: objectKey,
    });

    await this.s3Client.send(command);
    this.logger.debug(`Deleted object: ${objectKey}`);
  }

  /**
   * Check if an object exists in storage
   */
  async objectExists(objectKey: string): Promise<boolean> {
    if (this.driver === "local") {
      const full = this.safeLocalPathForKey(objectKey);
      try {
        await fs.stat(full);
        return true;
      } catch {
        return false;
      }
    }

    if (!this.s3Client || this.driver !== "s3") {
      throw new Error("S3 storage is not configured");
    }

    const bucket = this.configService.s3Bucket;

    try {
      const command = new HeadObjectCommand({
        Bucket: bucket,
        Key: objectKey,
      });
      await this.s3Client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === "NotFound") {
        return false;
      }
      throw error;
    }
  }
}
