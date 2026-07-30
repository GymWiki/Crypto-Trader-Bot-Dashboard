"use client";

import { createAuthClient } from "better-auth/react";
import { jwtClient } from "better-auth/client/plugins";

/**
 * This app never runs its own Better Auth server (no local `app/api/auth/*` route — see
 * ARCHITECTURE.md's "Auth provider" section) — it's a client pointed cross-origin at Neon's
 * hosted Better Auth server. Cross-origin means the session cookie Better Auth would normally set
 * only exists on Neon's own domain, unreachable to this app, so the bearer plugin's pattern is
 * used instead: the session token from the `set-auth-token` response header (captured in
 * `signIn.email`'s `onSuccess`, see app/(auth)/login/page.tsx) is stored here and reattached to
 * every subsequent authClient call via `fetchOptions.auth`.
 */
export const BEARER_TOKEN_STORAGE_KEY = "tp.bearer_token";

function getStoredBearerToken(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(BEARER_TOKEN_STORAGE_KEY) ?? "";
}

export function setStoredBearerToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) {
    window.localStorage.setItem(BEARER_TOKEN_STORAGE_KEY, token);
  } else {
    window.localStorage.removeItem(BEARER_TOKEN_STORAGE_KEY);
  }
}

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_NEON_AUTH_URL || undefined,
  plugins: [
    // @ts-expect-error — known better-auth type-inference gap between jwtClient()'s `getActions`
    // generics and the core `BetterAuthClientPlugin` interface (tracked across several of its
    // client plugins upstream, not specific to this setup). Deliberately NOT cast to
    // `BetterAuthClientPlugin` — that widens `Option` and breaks `useSession()`'s session-shape
    // inference elsewhere. Suppressing just this diagnostic keeps the plugin's real type intact
    // for `ReactAuthClient<Option>` to still resolve `authClient.token()` and a typed session.
    jwtClient(),
  ],
  fetchOptions: {
    auth: {
      type: "Bearer",
      token: getStoredBearerToken,
    },
  },
});

/**
 * `authClient.token` is added at runtime by the `jwtClient()` plugin registered above, but the
 * same better-auth type-inference gap that needed the `@ts-expect-error` above also stops
 * `InferActions<Option>` from surfacing it on `authClient`'s own type — so it's declared narrowly
 * here instead of widening the whole client's type.
 */
type JwtClientActions = {
  token: () => Promise<{
    data: { token: string } | null;
    error: { message?: string } | null;
  }>;
};

/**
 * The Bearer session token above authenticates authClient's own calls (getSession, signOut, ...)
 * against Neon Auth. It is NOT the token `Crypto-Trader-Bot`'s API expects — that's a separate,
 * EdDSA-signed JWT minted by the `jwt()` plugin, fetched fresh per request batch since Neon Auth
 * access tokens expire in 15 minutes (see ARCHITECTURE.md). `null` means no usable session.
 */
export async function getBackendAccessToken(): Promise<string | null> {
  const { data, error } = await (authClient as typeof authClient & JwtClientActions).token();
  if (error || !data?.token) return null;
  return data.token;
}
