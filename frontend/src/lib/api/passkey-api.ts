import type {
  BeginPasskeyAuthenticationInput,
  BeginPasskeyAuthenticationResult,
  BeginPasskeyRegistrationInput,
  BeginPasskeyRegistrationResult,
  DeletePasskeyResult,
  RenamePasskeyInput,
  VerifyPasskeyAuthenticationInput,
  VerifyPasskeyAuthenticationResult,
  VerifyPasskeyRegistrationInput,
  VerifyPasskeyRegistrationResult,
} from "@/types/auth";
import type { UserPasskey } from "@/types/user";

import { apiRequest } from "./client";

const BFF = {
  baseUrl: "",
  credentials: "same-origin" as const,
};

export const passkeyApi = {
  beginAuthentication: (input?: BeginPasskeyAuthenticationInput) =>
    apiRequest<BeginPasskeyAuthenticationResult>(
      "/api/auth/passkeys/authenticate/options",
      {
        method: "POST",
        body: input,
        ...BFF,
      },
    ),
  verifyAuthentication: (input: VerifyPasskeyAuthenticationInput) =>
    apiRequest<VerifyPasskeyAuthenticationResult>(
      "/api/auth/passkeys/authenticate/verify",
      {
        method: "POST",
        body: input,
        ...BFF,
      },
    ),
  beginRegistration: (input?: BeginPasskeyRegistrationInput) =>
    apiRequest<BeginPasskeyRegistrationResult>(
      "/api/users/me/passkeys/register/options",
      {
        method: "POST",
        body: input,
        ...BFF,
      },
    ),
  verifyRegistration: (input: VerifyPasskeyRegistrationInput) =>
    apiRequest<VerifyPasskeyRegistrationResult>(
      "/api/users/me/passkeys/register/verify",
      {
        method: "POST",
        body: input,
        ...BFF,
      },
    ),
  list: () =>
    apiRequest<{ passkeys: UserPasskey[] }>("/api/users/me/passkeys", BFF),
  rename: (passkeyId: string, input: RenamePasskeyInput) =>
    apiRequest<{ updated: boolean }>(`/api/users/me/passkeys/${passkeyId}`, {
      method: "PATCH",
      body: input,
      ...BFF,
    }),
  remove: (passkeyId: string) =>
    apiRequest<DeletePasskeyResult>(`/api/users/me/passkeys/${passkeyId}`, {
      method: "DELETE",
      ...BFF,
    }),
};
