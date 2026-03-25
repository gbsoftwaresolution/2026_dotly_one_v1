import { Test } from "@nestjs/testing";
import { ForbiddenException } from "@nestjs/common";
import { CardPublicController } from "./card.public.controller";
import { CardService } from "./card.service";
import { ConfigService } from "../config/config.service";
import { TurnstileService } from "../abuse/turnstile.service";

describe("CardPublicController (abuse hardening)", () => {
  const mockCardService = {
    createContactRequest: jest.fn(),
  };

  const mockConfig = {
    turnstileEnabled: false,
  };

  const mockTurnstile = {
    verifyToken: jest.fn(),
  };

  let controller: CardPublicController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [CardPublicController],
      providers: [
        { provide: CardService, useValue: mockCardService },
        { provide: ConfigService, useValue: mockConfig },
        { provide: TurnstileService, useValue: mockTurnstile },
      ],
    }).compile();

    controller = moduleRef.get(CardPublicController);
  });

  it("rejects when CAPTCHA enabled and token missing", async () => {
    mockConfig.turnstileEnabled = true;

    await expect(
      controller.createContactRequest("pub_1", "personal", {
        requesterName: "Alice",
        requesterEmail: "alice@example.com",
      } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(mockTurnstile.verifyToken).not.toHaveBeenCalled();
    expect(mockCardService.createContactRequest).not.toHaveBeenCalled();
  });

  it("rejects when CAPTCHA enabled and verification fails", async () => {
    mockConfig.turnstileEnabled = true;
    mockTurnstile.verifyToken.mockRejectedValueOnce(
      new ForbiddenException("CAPTCHA failed"),
    );

    await expect(
      controller.createContactRequest("pub_1", "personal", {
        requesterName: "Alice",
        requesterEmail: "alice@example.com",
        captchaToken: "bad",
      } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(mockCardService.createContactRequest).not.toHaveBeenCalled();
  });

  it("allows when CAPTCHA disabled", async () => {
    mockConfig.turnstileEnabled = false;
    mockCardService.createContactRequest.mockResolvedValueOnce({
      requestId: "req-1",
      status: "PENDING",
      createdAt: "2026-02-21T00:00:00.000Z",
    });

    const result = await controller.createContactRequest("pub_1", "personal", {
      requesterName: "Alice",
      requesterEmail: "alice@example.com",
    } as any);

    expect(mockTurnstile.verifyToken).not.toHaveBeenCalled();
    expect(mockCardService.createContactRequest).toHaveBeenCalled();
    expect(result.request.requestId).toBe("req-1");
  });
});
