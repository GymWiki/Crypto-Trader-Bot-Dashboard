# PLAN.md

Phase plan for the trading platform dashboard. One phase = one commit on
`claude/trading-dashboard-frontend-tvplmq`, conventional commit message. Ask for approval after
each phase, per the operating rules in the master brief. See `ARCHITECTURE.md` for the page map,
data flow, and — importantly — the list of places this plan deviates from the originally assumed
backend contract after inspecting the real one.

## Phase 0 — Planning (this commit)

`PLAN.md`, `ARCHITECTURE.md`. Stop for review before Phase 1.

## Phase 1 — Repo skeleton

- `create-next-app` (Next.js 15, App Router, TypeScript strict, Tailwind).
- shadcn/ui init + baseline primitives (button, card, badge, dialog, input, table, tabs, tooltip,
  skeleton).
- `.env.example` (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_NEON_AUTH_URL` — corrected from the brief's
  Supabase vars once the backend moved to Neon Auth, see `ARCHITECTURE.md`'s "Auth provider"
  section; done before any auth code existed).
- `CLAUDE.md` for this repo (conventions: file layout, `ApiResult` pattern, four-state component
  rule, no `any` in API types, commit style).
- `lib/api/client.ts` + `lib/api/types.ts`: the `ApiResult` discriminated union (per
  `ARCHITECTURE.md`), one hand-written type per backend schema (`TenantOut`, `BotOut`,
  `BotCreate`, `BotStatusUpdate`, `BotConfigOut`, `BotConfigCreate`, `CredentialOut`,
  `CredentialCreate`, `BacktestRunOut`, `OptimizationRunOut`) mirroring `api/schemas.py` exactly,
  including the enum unions from `core/enums.py` (`BotStatus`, `BotMode`, `BotTier`,
  `MembershipRole`, `TenantStatus`, `OptimizationRunStatus`).
- Base fetch wrapper: attaches `Authorization`, conditionally attaches `X-Tenant-Id`, classifies
  every response per the `ApiResult` shapes above (including the two different error bodies —
  `{"detail": string}` vs `{"detail": [{loc,msg,type}]}`).

## Phase 2 — Auth

- `lib/auth/` — `better-auth/react`'s `createAuthClient({ baseURL: NEXT_PUBLIC_NEON_AUTH_URL,
  plugins: [jwtClient()] })`, `middleware.ts` guarding `(app)/*`, redirect-to-`/login` on
  missing/expired session. No local `/api/auth/*` route — see `ARCHITECTURE.md`'s "Auth provider"
  section for why plain `better-auth` is used instead of Neon's own `@neondatabase/auth` package
  (Next.js 16 peer-dependency conflict with this repo's Next.js 15 pin).
- `/login` — email/password sign-in form (react-hook-form + zod) via `authClient.signIn.email()`,
  error states from the auth client itself (not `ApiResult` — this call doesn't go through the
  backend client).
- Global 401 handler: one place (a TanStack Query `onError`/query-client default) that attempts
  one session refresh via `authClient`, then redirects to `/login` on continued failure. No
  component handles 401 itself, per 4a.

## Phase 3 — Tenant resolution + `/setup`

- `lib/tenant/` — `GET /tenants` on session start, tenant context provider, switcher UI (shown
  only when >1 tenant), `localStorage` persistence, cache invalidation on switch.
- `lib/status/checks.ts` — the generic check registry, driving `/setup`:
  1. Backend reachable — `GET /healthz`.
  2. Auth configured — Neon Auth client init + session resolution.
  3. Backend ↔ Neon Auth link — `GET /tenants` (see `ARCHITECTURE.md` for why this replaces `/me`).
  4. Per-tenant exchange credentials — `GET /credentials`.
  5. At least one bot exists — `GET /bots`, informational only.
  6. Circuit breaker / kill switch — gray "not applicable, no backend route yet" (see deviations).
  7. Screener freshness — gray "not applicable, no backend route yet" (see deviations).
- Generic `CheckCard` component rendering any registry entry — adding a check later (once
  `/risk` or `/screener` routes ship) is a one-entry change, not new UI.
- `/setup` must render a complete, correctly-labeled page with `NEXT_PUBLIC_API_URL` pointed at
  nothing running and zero backend connectivity — this is its whole purpose, verified manually
  before moving on.
- Post-login redirect logic: `/setup` if any check is non-green, else `/bots`.

## Phase 4 — Bots

- `/bots` — list, `GET /bots`, status badges (`draft`/`running`/`paused`/`halted`/`stopped`),
  loading skeleton, empty state ("No bots yet → Create your first bot"), error state per 4b.
- `/bots/new` — `POST /bots` form: exchange, credential picker (from `GET /credentials`),
  strategy key/version, symbol, timeframe, mode/tier, `initial_allocation`, `quote_currency`,
  generic JSON params editor (see deviations — no schema-fetch endpoint exists). Inline
  `business_error`/`validation_error` messages near the relevant field.
- `/bots/[id]` — detail: `GET /bots/{id}` + `GET /bots/{id}/configs` (version history, newest
  first). Start/stop/pause via `PATCH /bots/{id}/status`, each transition gated by the backend's
  actual allowed-transition table (`draft→running|stopped`, `running→paused|stopped`,
  `paused→running|stopped`, `halted→stopped`, `stopped→` terminal) and a confirm-dialog. No
  delete action (route doesn't exist). Write actions hidden for `viewer` role.

## Phase 5 — Credentials

- `/credentials` — `GET /credentials` list (exchange, label, testnet flag, verified/revoked
  status only — never key material). Add form → `POST /credentials`. Revoke → `DELETE
  /credentials/{id}` behind a confirm-dialog. Write actions hidden for `viewer` role.

## Phase 6 — Wallet + Risk placeholders

- `/wallet`, `/risk` — `NotYetAvailable` component explaining these routes don't exist on the
  connected backend yet, with a link back to `/setup`. Risk page still builds the kill-switch and
  circuit-breaker-reset confirm-dialog components (double-confirm for kill switch, single-confirm
  for reset) as inert/disabled, ready to wire up the moment `Crypto-Trader-Bot` ships the routes,
  since the domain enums (`CircuitBreakerScope`, `CircuitBreakerStatus`) already exist backend-side.

## Phase 7 — Screener + Research

- `/screener` — `NotYetAvailable`.
- `/research` — `GET /backtests` + `GET /backtests/{id}` (metrics table; no equity-curve
  rendering — `equity_curve` isn't exposed by the backend, per its own docstring), `GET
  /optimization-runs` + `GET /optimization-runs/{id}`. "Submit new run" button present but
  disabled with a tooltip: runs are produced by `make backtest`/`make optimize` on the backend,
  not this API.

## Phase 8 — Audit log

- `/audit` — `NotYetAvailable` (no `/audit-log` route exists).

## Phase 9 — Global error boundary + polish

- Top-level `error.tsx` — unclassified errors, "copy error details" (stack + timestamp, no
  secrets), no blank screen.
- Persistent platform-wide banner slot wired for kill-switch/circuit-breaker state — inert until
  Phase 6's placeholder routes have real data (banner logic ships now, condition is always false
  today, documented as such rather than faked).
- Pass over every page's four states; `docs/testing.md` manual checklist.
- Accessibility pass (focus states, aria labels on status badges, keyboard-reachable
  confirm-dialogs).

## Out of scope (no backend support, not attempted)

Live trading, billing, anything the backend itself doesn't do (per its own `CLAUDE.md`
invariants — paper/testnet only). This repo will never call an endpoint that would place a live
order, because no such endpoint exists to call.
