import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import request from "supertest";
import { JwtModule } from "@nestjs/jwt";
import { HeirController } from "./heir.controller";
import { HeirService } from "./heir.service";
import { PrismaService } from "../../prisma/prisma.service";
import { ConfigService } from "../../config/config.service";
import { HeirAuthGuard } from "../../auth/guards/heir-auth.guard";

describe("HeirController (auth)", () => {
  let app: INestApplication;

  const heirSecret = "heir_secret_test";

  const recipient = {
    id: "recipient-1",
    ownerId: "owner-1",
    email: "heir@example.com",
    name: "Heir",
    accessCodeHash:
      "5694d08a2e53ffcae0c3103e5ad6f6076abd960eb1f8a56577040bc1028f702b", // sha256("code")
    verifiedAt: new Date("2024-01-01T00:00:00.000Z"),
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
  };

  const mockPrisma: any = {
    continuityRecipient: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    releaseInstance: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    lifeDoc: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const mockConfig: any = {
    get heirJwtSecret() {
      return heirSecret;
    },
    get heirJwtExpiresIn() {
      return "1h";
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockPrisma.continuityRecipient.findMany.mockResolvedValue([recipient]);
    mockPrisma.continuityRecipient.findUnique.mockResolvedValue({
      id: recipient.id,
      ownerId: recipient.ownerId,
    });
    mockPrisma.releaseInstance.findMany.mockResolvedValue([]);

    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: "dummy" })],
      controllers: [HeirController],
      providers: [
        HeirService,
        HeirAuthGuard,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("v1");
    await app.init();
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  it("login returns a signed heir JWT", async () => {
    const res = await request(app.getHttpServer())
      .post("/v1/heir/login")
      .send({ email: recipient.email, accessCode: "code" })
      .expect(201);

    expect(typeof res.body?.token).toBe("string");
    expect(res.body.token.split(".").length).toBe(3);
  });

  it("login rejects invalid credentials", async () => {
    await request(app.getHttpServer())
      .post("/v1/heir/login")
      .send({ email: recipient.email, accessCode: "wrong" })
      .expect(403);
  });

  it("protected route rejects missing token", async () => {
    await request(app.getHttpServer()).get("/v1/heir/releases").expect(401);
  });

  it("protected route rejects invalid token", async () => {
    await request(app.getHttpServer())
      .get("/v1/heir/releases")
      .set("Authorization", "Bearer not-a-real-token")
      .expect(401);
  });

  it("protected route accepts valid heir token", async () => {
    const login = await request(app.getHttpServer())
      .post("/v1/heir/login")
      .send({ email: recipient.email, accessCode: "code" })
      .expect(201);

    const token = login.body.token as string;

    await request(app.getHttpServer())
      .get("/v1/heir/releases")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(mockPrisma.releaseInstance.findMany).toHaveBeenCalledTimes(1);
  });
});
