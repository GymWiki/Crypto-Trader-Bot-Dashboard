# ARCHITECTURE.md

## What this repo is

The frontend-only dashboard for the trading platform control-plane API defined in
`GymWiki/Crypto-Trader-Bot`. This repo has **no knowledge of how or where the backend is
hosted, deployed, or run** — it knows exactly one thing about it: `NEXT_PUBLIC_API_URL`. It
also knows the Supabase project's public URL and anon key, because it authenticates directly
against the same Supabase project the backend validates tokens against. Beyond those two facts
it learns everything else at runtime by calling the backend and reacting to what comes back —
which is the entire reason `/setup` exists.

See `docs/repo-topology.md` for the one-paragraph version of this fact for anyone who lands in
this repo without context.

## Deviations from the original brief — read this first

The original brief (section 5) specified an assumed backend contract. Before writing any code,
this session read the actual FastAPI source in `Crypto-Trader-Bot` (`src/tradingplatform/api/`)
rather than build against a guess. Reality differs in ways that materially change this repo's
design, listed here per the brief's own instruction to "fix the client to match reality and note
the discrepancy" instead of silently guessing:

| Brief assumed | Reality | Impact here |
|---|---|---|
| `GET /health`, returns version | `GET /healthz` — `{"status":"ok"}`, DB-connectivity check, no version field | Setup check #1 hits `/healthz`; "show version" is dropped, not fabricated |
| `GET /me` for backend↔Supabase link check | No `/me` route exists anywhere | Setup check #3 uses `GET /tenants` instead — it's the one route that needs only a valid Bearer token and no tenant context, making it the correct bootstrap probe |
| Tenant scoping implicit in the JWT | Almost every route requires an `X-Tenant-Id` header in addition to the Bearer token (`api/deps.py::get_tenant_context`) | **New architectural layer**: a tenant-resolution step between login and any tenant-scoped page — see "Tenant resolution" below |
| Error envelope `{ error: { code, message, fields } }` | Domain errors → `{"detail": "<message string>"}`. Native FastAPI/Pydantic request validation (422) → `{"detail": [{"loc":[...], "msg": str, "type": str}]}` | `ApiResult`'s `business_error` has no `code`, only `message`; `validation_error.fields` is derived from `loc` on 422s only, not from 400s |
| `PATCH /bots/{id}` for status changes | `PATCH /bots/{id}/status`, body `{ status }` | Client path corrected |
| `DELETE /bots/{id}` | Does not exist | Bots page has no delete action; `stopped` is terminal instead |
| `GET /bots/{id}/state` | Does not exist | Bot detail page has no live-state panel; shows config history (`GET /bots/{id}/configs`) instead |
| `GET /wallet/{bot_id}`, `PATCH /wallet/{bot_id}` | Does not exist. `VirtualWallet` rows exist in the DB (created implicitly by `POST /bots`) but nothing exposes them | `/wallet` is a placeholder page — disabled state, not a guessed URL |
| `GET /risk/circuit-breaker`, `POST /risk/circuit-breaker/reset`, `POST /risk/kill-switch` | Do not exist. `CircuitBreakerScope`/`Status` enums exist in `core/enums.py` but no router exposes them | `/risk` is a placeholder; setup check #6 (circuit breaker banner) is permanently gray ("not applicable — endpoint not available") rather than silently omitted |
| `GET /screener/latest` | Does not exist | `/screener` is a placeholder; setup check #7 same as above |
| `GET /audit-log` | Does not exist | `/audit` is a placeholder |
| `POST /backtests`, `POST /optimizations` (submit a run) | Backend is **read-only** for both — `backtests.py`/`optimization_runs.py` docstrings say runs are produced by `make backtest`/`make optimize` CLI, never the API | `/research` is list/detail only; the "submit" UI exists but its action is disabled with a tooltip explaining runs come from the CLI |
| Strategy config validated against a schema fetched from the backend | No route exposes `strategies/registry.py::config_json_schema` | Bot create/config-version forms use a generic JSON params editor (client-side JSON-syntax validation only); the strategy's own validation still runs server-side on submit and 400s surface inline per 4b |
| Roles implied generically | `MembershipRole` is exactly `owner` / `admin` / `viewer`; write routes require owner-or-admin | UI hides/disables all mutating actions for `viewer` role, sourced from `GET /tenants` membership role, not guessed |

None of this shrinks the brief's page list (section 6) — every page it names still exists in the
nav. Pages backed by endpoints that don't exist yet render the same generic disabled/"not yet
available" component (`components/status/NotYetAvailable.tsx`) with a tooltip, per rule 3 of the
brief, rather than a fabricated request.

## Tenant resolution

Because `X-Tenant-Id` is a required header on nearly every route, session state is two-layered,
not one:

1. **Auth session** (Supabase) — resolves to a Bearer token or "signed out."
2. **Tenant context** — resolves from `GET /tenants` (Bearer-only call, lists every tenant the
   caller has a membership in, with their role in each). Cases:
   - Zero tenants → account has no memberships; `/setup` says so, nothing else works.
   - One tenant → auto-selected, stored client-side (see below), never asks.
   - More than one → a tenant switcher (top nav) is shown; last selection persisted.

Selected tenant id lives in `localStorage` (`tp.selected_tenant_id`) alongside the Supabase
session, read by `lib/api/client.ts` on every request that needs it. Switching tenants
invalidates all TanStack Query caches keyed by tenant-scoped resources.

`GET /tenants/me` (which *does* require `X-Tenant-Id`) is used to re-confirm the active tenant's
current role/status after a switch, since a role can change server-side between page loads.

## Page map → data flow

```
/login                    Supabase Auth (email/password). On success → tenant resolution → /setup (if any check non-green) or /bots.
/setup                    GET /healthz, GET /tenants (auth-link probe), GET /credentials, GET /bots, [gray: circuit-breaker, screener — no route]
/bots                     GET /bots
/bots/[id]                GET /bots/{id}, GET /bots/{id}/configs
/bots/new                 POST /bots  (strategy_key/version + generic JSON params editor)
/credentials               GET /credentials, POST /credentials, DELETE /credentials/{id}
/wallet                    placeholder — NotYetAvailable
/risk                      placeholder — NotYetAvailable (kill-switch/circuit-breaker UI shells built, wired to nothing yet)
/screener                  placeholder — NotYetAvailable
/research                  GET /backtests, GET /backtests/{id}, GET /optimization-runs, GET /optimization-runs/{id}; "submit" disabled
/audit                     placeholder — NotYetAvailable
```

Every arrow above is a direct browser → `NEXT_PUBLIC_API_URL` call (CORS-enabled on the backend
via `API_CORS_ORIGINS`); this repo has no server-side API proxy layer and no Next.js API routes
of its own. Supabase auth calls go directly to the Supabase project from the browser, per
`@supabase/ssr`'s standard client pattern; a `middleware.ts` refreshes the session cookie and
redirects unauthenticated requests to `/login` for every route under `(app)`.

## Where auth tokens live

- Supabase session (access + refresh token): browser cookies, managed by `@supabase/ssr`'s
  browser client and refreshed by `middleware.ts` on each navigation — never `localStorage`, so
  the token itself isn't reachable from arbitrary JS the way a stored value would be.
- Selected tenant id: `localStorage`, non-sensitive (just a UUID the user already has visible
  membership in).
- `lib/api/client.ts` reads the current Supabase access token via the browser client on every
  call and attaches `Authorization: Bearer <token>` + `X-Tenant-Id: <selected>` (when a tenant is
  selected and the route needs one — `GET /tenants` itself omits the header).

## `ApiResult` — adapted to the real error shapes

```typescript
type ApiResult<T> =
  | { kind: "success"; data: T }
  | { kind: "network_error"; message: string }
  | { kind: "unauthorized" }                                       // 401
  | { kind: "forbidden" }                                          // 403
  | { kind: "not_found" }                                          // 404
  | { kind: "validation_error"; fields: Record<string, string> }   // 422, `fields` built from `detail[].loc`
  | { kind: "business_error"; message: string }                    // 400/409, `detail` is a plain string — no `code`
  | { kind: "server_error"; status: number; message: string };     // 5xx
```

`business_error` drops the brief's `code` field because the backend's `PlatformError` handler
never emits one (`api/main.py::platform_error_handler` returns `{"detail": exc.message}` only).
Components that need to distinguish error subtypes do so by matching on `message` text where the
brief would have matched on `code` — documented per call site, not a general mechanism.

## Repo layout

Matches the brief's section 2 layout exactly, with two additions:

- `lib/tenant/` — tenant resolution and the active-tenant React context (`GET /tenants` fetch,
  switcher state, `localStorage` persistence).
- `components/status/NotYetAvailable.tsx` — the generic "not available on this backend build"
  component used by `/wallet`, `/risk`, `/screener`, `/audit`, and the research "submit" action.

## Deployment

Vercel, this repo only. `NEXT_PUBLIC_API_URL` and the Supabase public env vars are the only
required environment variables, settable per environment (Preview/Production) in Vercel project
settings. No Docker, no server config. See `docs/repo-topology.md`.
