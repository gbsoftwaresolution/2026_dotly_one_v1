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

  const forwardedFor = getHeaderValue(request, "x-forwarded-for");

  return (
    request.ip?.trim() ||
    request.socket?.remoteAddress?.trim() ||
    forwardedFor?.split(",")[0]?.trim() ||
    null
  );
}

export function getForwardedProtocol(request?: RequestLike): string | null {
  if (!request) {
    return null;
  }

  const forwardedProto = getHeaderValue(request, "x-forwarded-proto");

  return (
    request.protocol?.trim() ||
    forwardedProto?.split(",")[0]?.trim() ||
    (request.secure ? "https" : null)
  );
}