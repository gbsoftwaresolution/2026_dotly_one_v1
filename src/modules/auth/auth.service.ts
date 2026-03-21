import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { createHash, randomBytes } from "node:crypto";

import { MailService } from "../../infrastructure/mail/mail.service";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { AnalyticsService } from "../analytics/analytics.service";

import { LoginDto } from "./dto/login.dto";
import { ResendVerificationEmailDto } from "./dto/resend-verification-email.dto";
import { SignupDto } from "./dto/signup.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const EMAIL_VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;
const EMAIL_VERIFICATION_RESEND_WINDOW_MS = 60 * 60 * 1000;
const EMAIL_VERIFICATION_RESEND_LIMIT = 5;
const INVALID_VERIFICATION_MESSAGE = "Verification link is invalid or expired";

@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async signup(signupDto: SignupDto) {
    const existingUser = await this.prismaService.user.findUnique({
      where: {
        email: signupDto.email,
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      throw new ConflictException("Email already in use");
    }

    const passwordHash = await bcrypt.hash(signupDto.password, 10);

    try {
      const user = await this.prismaService.user.create({
        data: {
          email: signupDto.email,
          passwordHash,
          isVerified: false,
        },
        select: {
          id: true,
          email: true,
          isVerified: true,
        },
      });

      const verification = await this.issueEmailVerificationToken(
        user.id,
        user.email,
      );

      return {
        user,
        verificationPending: true,
        verificationEmailSent: verification.emailSent,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("Email already in use");
      }

      throw error;
    }
  }

  async login(loginDto: LoginDto) {
    const user = await this.prismaService.user.findUnique({
      where: {
        email: loginDto.email,
      },
    });

    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });

    return {
      accessToken,
    };
  }

  async verifyEmail(verifyEmailDto: VerifyEmailDto) {
    const tokenHash = this.hashVerificationToken(verifyEmailDto.token);
    const now = new Date();
    const token = await this.prismaService.emailVerificationToken.findUnique({
      where: {
        tokenHash,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            isVerified: true,
          },
        },
      },
    });

    if (!token) {
      throw new BadRequestException(INVALID_VERIFICATION_MESSAGE);
    }

    if (token.user.isVerified) {
      if (!token.consumedAt) {
        await this.prismaService.emailVerificationToken.update({
          where: {
            id: token.id,
          },
          data: {
            consumedAt: now,
          },
        });
      }

      return {
        verified: true,
        alreadyVerified: true,
        user: token.user,
      };
    }

    if (
      token.consumedAt ||
      token.supersededAt ||
      token.expiresAt.getTime() <= now.getTime()
    ) {
      throw new BadRequestException(INVALID_VERIFICATION_MESSAGE);
    }

    const user = await this.prismaService.$transaction(async (tx) => {
      const verifiedUser = await tx.user.update({
        where: {
          id: token.userId,
        },
        data: {
          isVerified: true,
        },
        select: {
          id: true,
          email: true,
          isVerified: true,
        },
      });

      await tx.emailVerificationToken.update({
        where: {
          id: token.id,
        },
        data: {
          consumedAt: now,
        },
      });

      await tx.emailVerificationToken.updateMany({
        where: {
          userId: token.userId,
          id: {
            not: token.id,
          },
          consumedAt: null,
          supersededAt: null,
        },
        data: {
          supersededAt: now,
        },
      });

      return verifiedUser;
    });

    await this.analyticsService.trackEmailVerified({
      actorUserId: user.id,
    });

    return {
      verified: true,
      alreadyVerified: false,
      user,
    };
  }

  async resendVerificationEmail(
    resendVerificationEmailDto: ResendVerificationEmailDto,
  ) {
    const user = await this.prismaService.user.findUnique({
      where: {
        email: resendVerificationEmailDto.email,
      },
      select: {
        id: true,
        email: true,
        isVerified: true,
      },
    });

    if (!user || user.isVerified) {
      return {
        accepted: true,
        verificationPending: false,
        verificationEmailSent: false,
      };
    }

    await this.assertCanResendVerificationEmail(user.id);

    const verification = await this.issueEmailVerificationToken(
      user.id,
      user.email,
      "resend",
    );

    await this.analyticsService.trackVerificationResend({
      actorUserId: user.id,
      emailSent: verification.emailSent,
    });

    return {
      accepted: true,
      verificationPending: true,
      verificationEmailSent: verification.emailSent,
    };
  }

  private async issueEmailVerificationToken(
    userId: string,
    email: string,
    context: "signup" | "resend" = "signup",
  ) {
    const now = new Date();
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = this.hashVerificationToken(rawToken);
    const expiresAt = new Date(now.getTime() + EMAIL_VERIFICATION_TTL_MS);

    await this.prismaService.$transaction(async (tx) => {
      await tx.emailVerificationToken.updateMany({
        where: {
          userId,
          consumedAt: null,
          supersededAt: null,
          expiresAt: {
            gt: now,
          },
        },
        data: {
          supersededAt: now,
        },
      });

      await tx.emailVerificationToken.create({
        data: {
          userId,
          tokenHash,
          expiresAt,
        },
      });
    });

    const emailSent = await this.mailService.sendEmailVerification({
      to: email,
      token: rawToken,
      expiresAt,
    });

    await this.analyticsService.trackVerificationEmailIssued({
      actorUserId: userId,
      context,
      emailSent,
    });

    return {
      emailSent,
      expiresAt,
    };
  }

  private async assertCanResendVerificationEmail(userId: string) {
    const now = new Date();
    const lastIssuedToken =
      await this.prismaService.emailVerificationToken.findFirst({
        where: {
          userId,
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          createdAt: true,
        },
      });

    if (
      lastIssuedToken &&
      now.getTime() - lastIssuedToken.createdAt.getTime() <
        EMAIL_VERIFICATION_RESEND_COOLDOWN_MS
    ) {
      throw new HttpException(
        "Please wait before requesting another verification email",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const recentIssueCount = await this.prismaService.emailVerificationToken.count(
      {
        where: {
          userId,
          createdAt: {
            gte: new Date(now.getTime() - EMAIL_VERIFICATION_RESEND_WINDOW_MS),
          },
        },
      },
    );

    if (recentIssueCount >= EMAIL_VERIFICATION_RESEND_LIMIT) {
      throw new HttpException(
        "Too many verification emails requested. Please try again later",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private hashVerificationToken(rawToken: string): string {
    return createHash("sha256").update(rawToken).digest("hex");
  }
}
