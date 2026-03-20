import { NextRequest } from "next/server";

import { ACCESS_TOKEN_COOKIE } from "./constants";

export function hasSession(request: NextRequest): boolean {
  return Boolean(request.cookies.get(ACCESS_TOKEN_COOKIE)?.value);
}

export { ACCESS_TOKEN_COOKIE };
