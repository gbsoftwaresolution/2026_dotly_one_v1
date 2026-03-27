import { describe, expect, it } from "vitest";

import { ApiError } from "./client";
import { createRouteErrorResponse } from "./route-error";

describe("createRouteErrorResponse", () => {
  it("surfaces upstream request ids for operator correlation", async () => {
    const response = createRouteErrorResponse(
      new ApiError("Unauthorized", 401, { message: "Unauthorized" }, "req_789"),
      "Unable to complete request.",
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("x-upstream-request-id")).toBe("req_789");
    await expect(response.json()).resolves.toEqual({
      message: "Unauthorized",
      requestId: "req_789",
    });
  });
});
