import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { PasskeysService } from "../src/modules/auth/passkeys.service";

type UserRecord = {
  id: string;
  email: string;
};

type PasskeyRecord = {
  id: string;
  userId: string;
  name: string;
  credentialId: string;
  publicKey: Buffer;
  counter: number;
  deviceType: string;
  backedUp: boolean;
  transports: string[];
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt: Date | null;
};

type ChallengeRecord = {
  id: string;
  userId: string | null;
  purpose: "REGISTRATION" | "AUTHENTICATION";
  challengeHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  supersededAt: Date | null;
  createdAt: Date;
};

function createPasskeysHarness() {
  const state = {
    users: [
      {
        id: "user-1",
        email: "user@dotly.one",
      },
    ] satisfies UserRecord[],
    passkeys: [
      {
        id: "passkey-1",
        userId: "user-1",
        name: "MacBook",
        credentialId: "credential-1",
        publicKey: Buffer.from("public-key"),
        counter: 1,
        deviceType: "singleDevice",
        backedUp: false,
        transports: ["internal"],
        createdAt: new Date("2026-03-28T10:00:00.000Z"),
        updatedAt: new Date("2026-03-28T10:00:00.000Z"),
        lastUsedAt: new Date("2026-03-28T11:00:00.000Z"),
      },
    ] satisfies PasskeyRecord[],
    challenges: [] as ChallengeRecord[],
    audits: [] as Array<Record<string, unknown>>,
  };

  let challengeSequence = 0;

  const prisma: any = {
    user: {
      findUnique: async ({ where, select }: any) => {
        const user = state.users.find((candidate) => candidate.id === where.id);

        if (!user) {
          return null;
        }

        return Object.fromEntries(
          Object.entries(select ?? {})
            .filter(([, value]) => value)
            .map(([key]) => [key, (user as Record<string, unknown>)[key]]),
        );
      },
    },
    passkeyCredential: {
      findMany: async ({ where, select }: any) =>
        state.passkeys
          .filter((candidate) => candidate.userId === where.userId)
          .map((candidate) =>
            Object.fromEntries(
              Object.entries(select ?? {})
                .filter(([, value]) => value)
                .map(([key]) => [
                  key,
                  (candidate as Record<string, unknown>)[key],
                ]),
            ),
          ),
      updateMany: async ({ where, data }: any) => {
        let count = 0;

        for (const passkey of state.passkeys) {
          if (passkey.id !== where.id || passkey.userId !== where.userId) {
            continue;
          }

          Object.assign(passkey, data, { updatedAt: new Date() });
          count += 1;
        }

        return { count };
      },
      deleteMany: async ({ where }: any) => {
        const retained = state.passkeys.filter(
          (candidate) =>
            candidate.id !== where.id || candidate.userId !== where.userId,
        );
        const count = state.passkeys.length - retained.length;
        state.passkeys.splice(0, state.passkeys.length, ...retained);
        return { count };
      },
    },
    passkeyChallenge: {
      updateMany: async ({ where, data }: any) => {
        let count = 0;

        for (const challenge of state.challenges) {
          if (
            challenge.userId === where.userId &&
            challenge.purpose === where.purpose &&
            challenge.consumedAt === where.consumedAt &&
            challenge.supersededAt === where.supersededAt
          ) {
            Object.assign(challenge, data);
            count += 1;
          }
        }

        return { count };
      },
      create: async ({ data }: any) => {
        state.challenges.push({
          id: `challenge-${++challengeSequence}`,
          userId: data.userId ?? null,
          purpose: data.purpose,
          challengeHash: data.challengeHash,
          expiresAt: data.expiresAt,
          consumedAt: null,
          supersededAt: null,
          createdAt: new Date(),
        });

        return { id: state.challenges.at(-1)?.id };
      },
    },
    $transaction: async (callback: (tx: any) => Promise<unknown>) =>
      callback(prisma),
  };

  const service = new PasskeysService(
    prisma,
    {
      get: (key: string, fallback?: unknown) => {
        if (key === "webauthn.rpId") {
          return "localhost";
        }

        if (key === "webauthn.rpName") {
          return "Dotly";
        }

        if (key === "webauthn.origins") {
          return ["http://localhost:3001"];
        }

        return fallback;
      },
    } as any,
    {
      issueAuthenticatedSession: async () => ({
        accessToken: "token",
        sessionId: "session-1",
        expiresAt: new Date("2026-04-04T00:00:00.000Z"),
      }),
    } as any,
    {
      log: (event: Record<string, unknown>) => {
        state.audits.push(event);
      },
    } as any,
  );

  return { service, state };
}

describe("PasskeysService", () => {
  it("starts passkey registration and stores a hashed registration challenge", async () => {
    const { service, state } = createPasskeysHarness();

    const result = await service.startRegistration("user-1");

    assert.equal(result.rpId, "localhost");
    assert.equal(result.rpName, "Dotly");
    assert.equal(result.options.user.name, "user@dotly.one");
    assert.equal(result.options.excludeCredentials?.[0]?.id, "credential-1");
    assert.equal(state.challenges.length, 1);
    assert.equal(state.challenges[0]?.purpose, "REGISTRATION");
    assert.equal(state.challenges[0]?.userId, "user-1");
    assert.notEqual(
      state.challenges[0]?.challengeHash,
      result.options.challenge,
    );
  });

  it("starts public passkey authentication and stores an anonymous challenge", async () => {
    const { service, state } = createPasskeysHarness();

    const result = await service.startAuthentication();

    assert.equal(result.rpId, "localhost");
    assert.equal(state.challenges.length, 1);
    assert.equal(state.challenges[0]?.purpose, "AUTHENTICATION");
    assert.equal(state.challenges[0]?.userId, null);
    assert.notEqual(
      state.challenges[0]?.challengeHash,
      result.options.challenge,
    );
  });

  it("lists, renames, and deletes a user's passkeys", async () => {
    const { service, state } = createPasskeysHarness();

    const listed = await service.listPasskeys("user-1");
    assert.equal(listed.passkeys.length, 1);
    assert.equal(listed.passkeys[0]?.name, "MacBook");

    const renamed = await service.renamePasskey(
      "user-1",
      "passkey-1",
      "Desk key",
    );
    assert.deepEqual(renamed, { updated: true });
    assert.equal(state.passkeys[0]?.name, "Desk key");

    const deleted = await service.deletePasskey("user-1", "passkey-1");
    assert.deepEqual(deleted, { deleted: true });
    assert.equal(state.passkeys.length, 0);
  });
});
