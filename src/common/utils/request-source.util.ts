type HeaderValue = string | string[] | undefined;

type RequestLike = {
  ip?: string;
  protocol?: string;
  secure?: boolean;
  headers?: Record<string, HeaderValue>;
  socket?: { remoteAddress?: string };
};

export function getHeaderValue(
  request: Pick<RequestLike, "headers">,
  headerName: string,
): string | null {
  const value = request.headers?.[headerName];

  if (Array.isArray(value)) {
    return value[0]?.trim() || null;
  }

  if (typeof value === "string") {
    return value.trim() || null;
  }

  return null;
}

export function getClientIpAddress(request?: RequestLike): string | null {
  if (!request) {
    return null;
  }

  return request.ip?.trim() || request.socket?.remoteAddress?.trim() || null;
}

export function getForwardedProtocol(request?: RequestLike): string | null {
  if (!request) {
    return null;
  }

  return request.protocol?.trim() || (request.secure ? "https" : null);
}
