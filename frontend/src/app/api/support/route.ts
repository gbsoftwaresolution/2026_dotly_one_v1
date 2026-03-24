import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import type {
  CreateSupportRequestInput,
  CreateSupportRequestResult,
} from "@/types/support";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateSupportRequestInput;
    const result = await apiRequest<CreateSupportRequestResult>("/support", {
      method: "POST",
      body,
      headers: Object.fromEntries(
        ["x-request-id", "user-agent"]
          .map((header) => [header, request.headers.get(header) ?? ""])
          .filter(([, value]) => value.length > 0),
      ),
    });

    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    return createRouteErrorResponse(
      error,
      "Unable to send your support request right now.",
    );
  }
}
