import { useQuery } from "@tanstack/react-query";

import { authClient, getBackendAccessToken, setStoredBearerToken } from "@/lib/auth/client";
import type { RequestAuth } from "./client";
import type { ApiResult } from "./result";

async function forceSignOutAndRedirect(): Promise<void> {
  setStoredBearerToken(null);
  try {
    await authClient.signOut();
  } catch {
    // best-effort — redirecting to /login regardless
  }
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}

/**
 * Centralizes CLAUDE.md invariant #7: components never handle `kind: "unauthorized"` themselves.
 * Fetches a fresh backend JWT (short-lived — 15 min, see lib/auth/client.ts), runs `queryFn`, and
 * on an unauthorized result retries once with a freshly re-fetched token (the stored one may just
 * be stale) before forcing sign-out and a hard redirect to `/login`. `tenantId` is threaded
 * through by the caller (from `lib/tenant/`'s context, Phase 3+) — this hook has no tenant
 * knowledge of its own.
 */
export function useAuthedQuery<T>(options: {
  queryKey: unknown[];
  queryFn: (auth: RequestAuth) => Promise<ApiResult<T>>;
  tenantId?: string | null;
  enabled?: boolean;
}) {
  return useQuery<ApiResult<T>>({
    queryKey: options.queryKey,
    enabled: options.enabled,
    queryFn: async () => {
      const accessToken = await getBackendAccessToken();
      const result = await options.queryFn({ accessToken, tenantId: options.tenantId ?? null });
      if (result.kind !== "unauthorized") return result;

      const retryToken = await getBackendAccessToken();
      const retryResult = await options.queryFn({
        accessToken: retryToken,
        tenantId: options.tenantId ?? null,
      });
      if (retryResult.kind !== "unauthorized") return retryResult;

      await forceSignOutAndRedirect();
      // Redirect is in flight (page is about to unload) — never resolve, so no component ever
      // renders an "unauthorized" ApiResult.
      return new Promise<ApiResult<T>>(() => {});
    },
  });
}
