import { NextResponse } from "next/server";

import { createUnauthorizedRouteResponse } from "@/lib/api/auth-route-response";
import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import { getServerAccessToken } from "@/lib/auth/server-session";
import type { DeletePasskeyResult, RenamePasskeyInput } from "@/types/auth";
import type { UserPasskey } from "@/types/user";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ passkeyId: string }> },
) {
  const accessToken = await getServerAccessToken();

  if (!accessToken) {
    return createUnauthorizedRouteResponse();
  }

  try {
    const { passkeyId } = await context.params;
    const body = (await request.json()) as RenamePasskeyInput;
    const result = await apiRequest<{ passkey: UserPasskey }>(
      `/users/me/passkeys/${encodeURIComponent(passkeyId)}`,
      {
        method: "PATCH",
        body,
        token: accessToken,
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    return createRouteErrorResponse(error, "Unable to rename that passkey.");
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ passkeyId: string }> },
) {
  const accessToken = await getServerAccessToken();

  if (!accessToken) {
    return createUnauthorizedRouteResponse();
  }

  try {
    const { passkeyId } = await context.params;
    const result = await apiRequest<DeletePasskeyResult>(
      `/users/me/passkeys/${encodeURIComponent(passkeyId)}`,
      {
        method: "DELETE",
        token: accessToken,
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    return createRouteErrorResponse(error, "Unable to remove that passkey.");
  }
}
