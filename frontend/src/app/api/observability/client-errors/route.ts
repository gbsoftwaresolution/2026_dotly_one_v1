import { NextResponse } from "next/server";

import type { RuntimeErrorPayload } from "@/lib/observability/runtime-error";
import { writeStructuredObservabilityError } from "@/lib/observability/structured-log";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRuntimeErrorPayload(value: unknown): value is RuntimeErrorPayload {
  return (
    isObject(value) &&
    typeof value.source === "string" &&
    isObject(value.error) &&
    typeof value.error.name === "string" &&
    typeof value.error.message === "string"
  );
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid JSON payload." },
      { status: 400 },
    );
  }

  if (!isRuntimeErrorPayload(body)) {
    return NextResponse.json(
      { message: "Invalid client error payload." },
      { status: 400 },
    );
  }

  writeStructuredObservabilityError("Client runtime error reported", {
    report: body,
    request: {
      path: new URL(request.url).pathname,
      userAgent: request.headers.get("user-agent"),
      forwardedFor: request.headers.get("x-forwarded-for"),
    },
  });

  return new NextResponse(null, { status: 202 });
}
