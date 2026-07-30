# CLAUDE.md — conventions for this repository

Frontend-only dashboard for the `Crypto-Trader-Bot` control-plane API. Read `PLAN.md` for the
phase plan and `ARCHITECTURE.md` before making structural changes — in particular its "Deviations
from the original brief" table, which documents where the real backend contract differs from what
was originally assumed, and why several pages are deliberately built as disabled placeholders.

## What this is

Next.js 15 (App Router), TypeScript strict. Talks to the backend purely through
`NEXT_PUBLIC_API_URL` and authenticates directly against Neon Auth (Managed Better Auth) — it has
zero knowledge of how or where the backend itself is hosted. See `docs/repo-topology.md` and
`ARCHITECTURE.md`'s "Auth provider" section (this was Supabase Auth per the original brief, moved
to Neon Auth before Phase 2's auth code existed, matching the backend's own move to Neon).

## Commands

- `npm install` — install dependencies
- `npm run dev` — local dev server
- `npm run build` — production build
- `npm run lint` — ESLint
- `npm run typecheck` — `tsc --noEmit`, must stay clean before considering a phase done

## Non-negotiable invariants

1. **TypeScript strict, no `any` in API response types.** Every backend schema gets a
   hand-written interface in `lib/api/types.ts` mirroring `Crypto-Trader-Bot`'s
   `api/schemas.py`/`core/enums.py` exactly — not a guess, not a widened type.
2. **Every backend call goes through `lib/api/client.ts`'s `apiRequest`** and resolves to an
   `ApiResult<T>` (`lib/api/result.ts`). No component ever catches a bare thrown `Error` from a
   backend call and has to guess what kind of failure it was.
3. **Every data-fetching component renders exactly one of four states**: loading (skeleton
   matching the eventual layout), empty (resource-specific CTA, never a generic "No data"),
   error (from the `ApiResult` kind, always with a retry action), success. No fifth "silent
   nothing" — see brief section 4d. Never swallow a failure into `console.log` and render as if
   it succeeded.
4. **Never invent a backend endpoint.** If a feature needs a route that doesn't exist on the real
   backend (see `ARCHITECTURE.md`'s deviations table), build it as a visibly disabled state using
   `components/status/NotYetAvailable.tsx`, not a guessed URL.
5. **No exchange credential material is ever rendered**, matching the backend's own
   `CredentialOut` shape, which structurally cannot carry one.
6. **The kill switch and circuit-breaker reset are confirm-dialog gated** (kill switch:
   double-confirm) and visually distinct from routine actions, whenever those routes exist to
   wire up to.
7. **401 handling is centralized.** One handler (wired in Phase 2) attempts a token refresh then
   redirects to `/login`. Individual components never handle `unauthorized` themselves.
8. **Money/allocation fields are strings on the wire** (`BotCreate.initial_allocation`,
   `OptimizationRunOut.best_value`) to match the backend's `Decimal`/`NUMERIC(38,18)` — never
   coerced to `number` in a request or response type, to avoid silent precision loss.

## Code conventions

- One phase (per `PLAN.md`) = one commit, conventional commit message (`feat:`, `fix:`, `docs:`,
  `refactor:`, `test:`, `chore:`).
- `lib/api/` — one file per resource (`bots.ts`, `credentials.ts`, ...), all built on
  `lib/api/client.ts`. Resource files accept a `RequestAuth` (access token + tenant id) as a
  parameter rather than reaching into a global — callers source it from `lib/tenant/`'s context.
- `components/ui/` — shadcn/ui primitives. **This environment cannot reach `ui.shadcn.com`**
  (network policy blocks it — confirmed via `$HTTPS_PROXY/__agentproxy/status`), so the `shadcn`
  CLI's `init`/`add` cannot be used here. Existing primitives were hand-written to match the
  canonical shadcn/ui (New York style, Radix base, Tailwind v4 CSS-variable theming) source
  exactly. Add new ones the same way — copy the shape/conventions of an existing file in
  `components/ui/` — unless a future session confirms registry access works, in which case
  `npx shadcn@latest add <component>` is preferred.
- Tailwind v4, CSS-first config (`app/globals.css`'s `@theme inline`, no `tailwind.config.ts`).
  `success`/`warning` color tokens were added alongside shadcn's stock palette specifically for
  the `/setup` page's green/amber/red/gray check badges.
- Forms: `react-hook-form` + `zod` resolver (`@hookform/resolvers`). Mirror the backend's Pydantic
  field constraints where practical, but validation errors from the backend (`business_error`,
  `validation_error.fields`) always win over client-side validation when they disagree — show
  them inline near the relevant field, not as a generic toast.
