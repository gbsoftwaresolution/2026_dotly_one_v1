import { apiJson, waitForApiReady } from "./api";

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
};

export type AuthUser = {
  id: string;
  email: string;
  displayName?: string | null;
};

export async function registerAndLogin(input: {
  email: string;
  password: string;
  displayName?: string;
}): Promise<{ user: AuthUser; session: AuthSession }> {
  await waitForApiReady();

  // Register returns a session already, so login is only needed for retries.
  try {
    const res = await apiJson<{ user: AuthUser; session: AuthSession }>(
      "/v1/auth/register",
      {
        method: "POST",
        body: {
          email: input.email,
          password: input.password,
          displayName: input.displayName ?? "Playwright Owner",
        },
      },
    );

    return res;
  } catch {
    // Fall back to login if user already exists (or register constraints change).
    const res = await apiJson<{ user: AuthUser; session: AuthSession }>(
      "/v1/auth/login",
      {
        method: "POST",
        body: {
          email: input.email,
          password: input.password,
        },
      },
    );

    return res;
  }
}
