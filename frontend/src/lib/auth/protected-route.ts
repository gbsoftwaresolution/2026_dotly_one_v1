import { redirect } from "next/navigation";
import { cache } from "react";

import { ApiError } from "@/lib/api/client";
import { userApi } from "@/lib/api/user-api";

import { getServerAccessToken } from "./server-session";

const getValidatedUser = cache(async (accessToken: string) =>
  userApi.me(accessToken),
);

function buildLoginRedirect(nextPath: string): string {
  const loginUrl = new URL("/login", "http://dotly.local");
  loginUrl.searchParams.set("next", nextPath);

  return `${loginUrl.pathname}${loginUrl.search}`;
}

export async function requireServerAccessToken(
  nextPath = "/app-old",
): Promise<string> {
  const accessToken = await getServerAccessToken();

  if (!accessToken) {
    redirect(buildLoginRedirect(nextPath));
  }

  return accessToken;
}

export async function requireServerSession(
  nextPath = "/app-old",
): Promise<{
  accessToken: string;
  user: Awaited<ReturnType<typeof userApi.me>>;
}> {
  const accessToken = await requireServerAccessToken(nextPath);

  try {
    const user = await getValidatedUser(accessToken);

    return {
      accessToken,
      user,
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect(`${buildLoginRedirect(nextPath)}&reason=expired`);
    }

    throw error;
  }
}
