import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  PersonaAccessMode as PrismaPersonaAccessMode,
  QrStatus as PrismaQrStatus,
  QrType as PrismaQrType,
} from "@prisma/client";

import { JwtAuthGuard } from "../src/common/guards/jwt-auth.guard";
import { QrService } from "../src/modules/qr/qr.service";

describe("JwtAuthGuard hardening", () => {
  it("verifies tokens with issuer and audience constraints", async () => {
    let verifyOptions: Record<string, unknown> | null = null;

    const guard = new JwtAuthGuard(
      {
        verifyAsync: async (
          _token: string,
          options: Record<string, unknown>,
        ) => {
          verifyOptions = options;
          return {
            sub: "user-1",
            email: "user@example.com",
          };
        },
      } as any,
      {
        get: (key: string, fallback: string) => fallback,
      } as any,
      {
        user: {
          findUnique: async () => ({
            id: "user-1",
            email: "user@example.com",
            isVerified: false,
          }),
        },
      } as any,
    );

    const request: any = {
      headers: {
        authorization: "Bearer token",
      },
    };

    const result = await guard.canActivate({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as any);

    assert.equal(result, true);
    assert.deepEqual(verifyOptions, {
      issuer: "dotly-backend",
      audience: "dotly-clients",
    });
    assert.deepEqual(request.user, {
      id: "user-1",
      email: "user@example.com",
      isVerified: false,
    });
  });

  it("rejects tokens without required claims", async () => {
    const guard = new JwtAuthGuard(
      {
        verifyAsync: async () => ({
          sub: "",
          email: "user@example.com",
        }),
      } as any,
      {
        get: (_key: string, fallback: string) => fallback,
      } as any,
      {
        user: {
          findUnique: async () => ({
            id: "user-1",
            email: "user@example.com",
            isVerified: false,
          }),
        },
      } as any,
    );

    await assert.rejects(
      guard.canActivate({
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: "Bearer token",
            },
          }),
        }),
      } as any),
      (error: unknown) => {
        assert.ok(error instanceof UnauthorizedException);
        assert.equal(error.message, "Invalid authentication token");
        return true;
      },
    );
  });
});

describe("QrService hardening", () => {
  it("rejects profile QR creation for private personas", async () => {
    const service = new QrService(
      {
        qRAccessToken: {
          findFirst: async () => null,
        },
        persona: {
          findUnique: async () => ({
            id: "persona-id",
            accessMode: PrismaPersonaAccessMode.PRIVATE,
          }),
        },
      } as any,
      {} as any,
      {
        findOwnedPersonaIdentity: async () => ({ id: "persona-id" }),
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await assert.rejects(
      service.createProfileQr("user-id", "persona-id"),
      (error: unknown) => {
        assert.ok(error instanceof ConflictException);
        assert.equal(
          error.message,
          "Private personas cannot create public QR codes",
        );
        return true;
      },
    );
  });

  it("rejects resolving profile QR codes for private personas", async () => {
    const service = new QrService(
      {
        $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
          callback({
            qRAccessToken: {
              findUnique: async (args: any) => {
                if (args.where.code) {
                  return {
                    id: "qr-token-id",
                    code: "qr-code",
                    type: PrismaQrType.profile,
                    startsAt: null,
                    endsAt: null,
                    maxUses: null,
                    usedCount: 0,
                    status: PrismaQrStatus.active,
                  };
                }

                if (args.select?.persona?.select?.accessMode) {
                  return {
                    persona: {
                      accessMode: PrismaPersonaAccessMode.PRIVATE,
                    },
                  };
                }

                return {
                  code: "qr-code",
                  type: PrismaQrType.profile,
                  persona: {
                    id: "persona-id",
                    username: "alice",
                    fullName: "Alice Demo",
                    jobTitle: "Founder",
                    companyName: "Dotly",
                    tagline: "Hidden",
                    profilePhotoUrl: null,
                  },
                };
              },
            },
          }),
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { trackQrScan: async () => true } as any,
    );

    await assert.rejects(service.resolveQr("qr-code"), (error: unknown) => {
      assert.ok(error instanceof NotFoundException);
      assert.equal(error.message, "QR code not found");
      return true;
    });
  });
});
