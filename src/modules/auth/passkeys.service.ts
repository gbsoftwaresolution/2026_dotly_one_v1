import {
  BadRequestException,
  Inject,
  Injectable,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { createHash } from "node:crypto";

import { PrismaService } from "../../infrastructure/database/prisma.service";
import {
  SecurityAuditService,
  noopSecurityAuditService,
} from "../../infrastructure/logging/security-audit.service";
import { AuthService } from "./auth.service";
import {
  AUTH_ERROR_MESSAGES,
  authBadRequest,
  authNotFound,
  authUnauthorized,
} from "./auth-error-policy";
import type { AuthActionContext } from "./auth-abuse-protection.service";

const PASSKEY_CHALLENGE_TTL_MS = 10 * 60 * 1000;

type ChallengePurpose = "REGISTRATION" | "AUTHENTICATION";

@Injectable()
export class PasskeysService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
    @Optional()
    @Inject(SecurityAuditService)
    private readonly securityAuditService: Pick<
      SecurityAuditService,
      "log"
    > = noopSecurityAuditService,
  ) {}

  private get prisma(): any {
    return this.prismaService as any;
  }

  async startAuthentication(context?: AuthActionContext) {
    const options = (await generateAuthenticationOptions({
      rpID: this.getRpId(),
      userVerification: "required",
    })) as PublicKeyCredentialRequestOptionsJSON;

    await this.storeChallenge(null, "AUTHENTICATION", options.challenge);

    this.logAudit("auth.passkey.authentication.start", "accepted", {
      requestContext: context,
      metadata: {
        rpId: this.getRpId(),
      },
    });

    return {
      options,
      rpId: this.getRpId(),
    };
  }

  async finishAuthentication(
    response: AuthenticationResponseJSON,
    context?: AuthActionContext,
  ) {
    const credential = (await this.prisma.passkeyCredential.findUnique({
      where: {
        credentialId: response.id,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    })) as {
      id: string;
      credentialId: string;
      publicKey: Buffer | Uint8Array<ArrayBufferLike>;
      counter: number;
      transports?: string[];
      user: { id: string; email: string } | null;
    } | null;

    if (!credential?.user) {
      this.logAudit("auth.passkey.authentication.finish", "failure", {
        requestContext: context,
        reason: "credential_not_found",
        metadata: {
          credentialId: response.id,
        },
      });
      throw authUnauthorized(AUTH_ERROR_MESSAGES.invalidCredentials);
    }

    const challenge = await this.consumeChallenge(
      null,
      "AUTHENTICATION",
      this.extractChallengeFromClientData(response.response.clientDataJSON),
    );

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge.rawChallenge,
      expectedOrigin: this.getExpectedOrigins(),
      expectedRPID: [this.getRpId()],
      requireUserVerification: true,
      credential: {
        id: credential.credentialId,
        publicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        transports: this.normalizeTransports(credential.transports),
      },
    });

    if (!verification.verified) {
      throw authUnauthorized(AUTH_ERROR_MESSAGES.invalidCredentials);
    }

    await this.prisma.passkeyCredential.update({
      where: {
        id: credential.id,
      },
      data: {
        counter: verification.authenticationInfo.newCounter,
        backedUp: verification.authenticationInfo.credentialBackedUp,
        deviceType: verification.authenticationInfo.credentialDeviceType,
        lastUsedAt: new Date(),
      },
      select: {
        id: true,
      },
    });

    const session = await this.authService.issueAuthenticatedSession(
      credential.user,
      context,
    );

    this.logAudit("auth.passkey.authentication.finish", "success", {
      actorUserId: credential.user.id,
      requestContext: context,
      sessionId: session.sessionId,
      targetType: "passkey_credential",
      targetId: credential.id,
    });

    return {
      ...session,
      method: "passkey",
    };
  }

  async startRegistration(userId: string, context?: AuthActionContext) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        email: true,
      },
    });

    if (!user) {
      throw authUnauthorized();
    }

    const existingCredentials = (await this.prisma.passkeyCredential.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        credentialId: true,
        transports: true,
      },
    })) as Array<{ credentialId: string; transports?: string[] }>;

    const options = (await generateRegistrationOptions({
      rpID: this.getRpId(),
      rpName: this.getRpName(),
      userName: user.email,
      userDisplayName: user.email,
      userID: new Uint8Array(Buffer.from(user.id, "utf8")),
      timeout: PASSKEY_CHALLENGE_TTL_MS,
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "required",
      },
      excludeCredentials: existingCredentials.map(
        (credential: { credentialId: string; transports?: string[] }) => ({
          id: credential.credentialId,
          transports: this.normalizeTransports(credential.transports),
        }),
      ),
      preferredAuthenticatorType: "localDevice",
    })) as PublicKeyCredentialCreationOptionsJSON;

    await this.storeChallenge(user.id, "REGISTRATION", options.challenge);

    this.logAudit("auth.passkey.registration.start", "accepted", {
      actorUserId: userId,
      requestContext: context,
      metadata: {
        existingPasskeys: existingCredentials.length,
      },
    });

    return {
      options,
      rpId: this.getRpId(),
      rpName: this.getRpName(),
    };
  }

  async finishRegistration(
    userId: string,
    response: RegistrationResponseJSON,
    name: string | undefined,
    context?: AuthActionContext,
  ) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        email: true,
      },
    });

    if (!user) {
      throw authUnauthorized();
    }

    const challenge = await this.consumeChallenge(
      userId,
      "REGISTRATION",
      this.extractChallengeFromClientData(response.response.clientDataJSON),
    );

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge.rawChallenge,
      expectedOrigin: this.getExpectedOrigins(),
      expectedRPID: [this.getRpId()],
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw authBadRequest(AUTH_ERROR_MESSAGES.passkeyRegistrationFailed);
    }

    const passkeyName = this.normalizePasskeyName(name);

    try {
      const saved = await this.prisma.passkeyCredential.create({
        data: {
          userId,
          name: passkeyName,
          credentialId: verification.registrationInfo.credential.id,
          publicKey: Buffer.from(
            verification.registrationInfo.credential.publicKey,
          ),
          counter: verification.registrationInfo.credential.counter,
          deviceType: verification.registrationInfo.credentialDeviceType,
          backedUp: verification.registrationInfo.credentialBackedUp,
          transports: this.normalizeTransports(
            response.response.transports ?? [],
          ),
          lastUsedAt: new Date(),
        },
        select: {
          id: true,
          name: true,
          createdAt: true,
        },
      });

      this.logAudit("auth.passkey.registration.finish", "success", {
        actorUserId: userId,
        requestContext: context,
        targetType: "passkey_credential",
        targetId: saved.id,
      });

      return {
        id: saved.id,
        name: saved.name,
        createdAt: saved.createdAt,
      };
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        throw authBadRequest(AUTH_ERROR_MESSAGES.passkeyAlreadyRegistered);
      }

      throw error;
    }
  }

  async listPasskeys(userId: string) {
    const passkeys = (await this.prisma.passkeyCredential.findMany({
      where: {
        userId,
      },
      orderBy: [{ lastUsedAt: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        lastUsedAt: true,
        deviceType: true,
        backedUp: true,
      },
    })) as Array<{
      id: string;
      name: string;
      createdAt: Date;
      updatedAt: Date;
      lastUsedAt: Date | null;
      deviceType: string;
      backedUp: boolean;
    }>;

    return {
      passkeys: passkeys.map(
        (passkey: {
          id: string;
          name: string;
          createdAt: Date;
          updatedAt: Date;
          lastUsedAt: Date | null;
          deviceType: string;
          backedUp: boolean;
        }) => passkey,
      ),
    };
  }

  async renamePasskey(userId: string, passkeyId: string, name: string) {
    const updated = await this.prisma.passkeyCredential.updateMany({
      where: {
        id: passkeyId,
        userId,
      },
      data: {
        name: this.normalizePasskeyName(name),
      },
    });

    if (updated.count === 0) {
      throw authNotFound(AUTH_ERROR_MESSAGES.passkeyNotFound);
    }

    this.logAudit("auth.passkey.rename", "success", {
      actorUserId: userId,
      targetType: "passkey_credential",
      targetId: passkeyId,
    });

    return {
      updated: true,
    };
  }

  async deletePasskey(userId: string, passkeyId: string) {
    const deleted = await this.prisma.passkeyCredential.deleteMany({
      where: {
        id: passkeyId,
        userId,
      },
    });

    if (deleted.count === 0) {
      throw authNotFound(AUTH_ERROR_MESSAGES.passkeyNotFound);
    }

    this.logAudit("auth.passkey.delete", "success", {
      actorUserId: userId,
      targetType: "passkey_credential",
      targetId: passkeyId,
    });

    return {
      deleted: true,
    };
  }

  private async storeChallenge(
    userId: string | null,
    purpose: ChallengePurpose,
    rawChallenge: string,
  ) {
    const now = new Date();

    await this.prismaService.$transaction(async (tx: any) => {
      if (userId) {
        await tx.passkeyChallenge.updateMany({
          where: {
            purpose,
            userId,
            consumedAt: null,
            supersededAt: null,
          },
          data: {
            supersededAt: now,
          },
        });
      }

      await tx.passkeyChallenge.create({
        data: {
          userId,
          purpose,
          challengeHash: this.hashChallenge(rawChallenge),
          expiresAt: new Date(now.getTime() + PASSKEY_CHALLENGE_TTL_MS),
        },
        select: {
          id: true,
        },
      });
    });
  }

  private async consumeChallenge(
    userId: string | null,
    purpose: ChallengePurpose,
    rawChallenge: string,
  ) {
    const now = new Date();
    const challengeHash = this.hashChallenge(rawChallenge);
    const challenge = await this.prisma.passkeyChallenge.findFirst({
      where: {
        userId,
        purpose,
        challengeHash,
        consumedAt: null,
        supersededAt: null,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        expiresAt: true,
      },
    });

    if (!challenge) {
      throw authBadRequest(AUTH_ERROR_MESSAGES.passkeyChallengeInvalid);
    }

    if (challenge.expiresAt.getTime() <= now.getTime()) {
      await this.prisma.passkeyChallenge.update({
        where: {
          id: challenge.id,
        },
        data: {
          supersededAt: now,
        },
        select: {
          id: true,
        },
      });
      throw authBadRequest(AUTH_ERROR_MESSAGES.passkeyChallengeExpired);
    }

    await this.prisma.passkeyChallenge.update({
      where: {
        id: challenge.id,
      },
      data: {
        consumedAt: now,
      },
      select: {
        id: true,
      },
    });

    return {
      id: challenge.id,
      rawChallenge,
    };
  }

  private normalizePasskeyName(name: string | undefined): string {
    const normalized = name?.trim();

    if (!normalized) {
      return `Passkey ${new Date().toISOString().slice(0, 10)}`;
    }

    if (normalized.length > 120) {
      throw new BadRequestException(
        "Passkey name must be 120 characters or less.",
      );
    }

    return normalized;
  }

  private hashChallenge(challenge: string): string {
    return createHash("sha256").update(challenge).digest("hex");
  }

  private normalizeTransports(
    transports: string[] | undefined,
  ): Array<
    "ble" | "cable" | "hybrid" | "internal" | "nfc" | "smart-card" | "usb"
  > {
    const allowed = new Set([
      "ble",
      "cable",
      "hybrid",
      "internal",
      "nfc",
      "smart-card",
      "usb",
    ]);

    return (transports ?? []).filter((transport) =>
      allowed.has(transport),
    ) as Array<
      "ble" | "cable" | "hybrid" | "internal" | "nfc" | "smart-card" | "usb"
    >;
  }

  private getRpId(): string {
    return this.configService.get<string>("webauthn.rpId", "localhost");
  }

  private getRpName(): string {
    return this.configService.get<string>("webauthn.rpName", "Dotly");
  }

  private getExpectedOrigins(): string[] {
    return this.configService.get<string[]>("webauthn.origins", [
      "http://localhost:3001",
    ]);
  }

  private extractChallengeFromClientData(clientDataJSON: string): string {
    try {
      const decoded = JSON.parse(
        Buffer.from(clientDataJSON, "base64url").toString("utf8"),
      ) as { challenge?: string };

      if (!decoded.challenge) {
        throw new Error("Missing challenge");
      }

      return decoded.challenge;
    } catch {
      throw authBadRequest(AUTH_ERROR_MESSAGES.passkeyChallengeInvalid);
    }
  }

  private logAudit(
    action: string,
    outcome: "accepted" | "success" | "failure",
    input: {
      actorUserId?: string | null;
      requestContext?: AuthActionContext;
      sessionId?: string | null;
      targetType?: string | null;
      targetId?: string | null;
      reason?: string | null;
      metadata?: Record<string, unknown>;
    },
  ) {
    this.securityAuditService.log({
      action,
      outcome,
      actorUserId: input.actorUserId,
      requestId: input.requestContext?.requestId,
      sessionId: input.sessionId ?? input.requestContext?.sessionId,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      metadata: input.metadata,
    });
  }
}
