# Trading Platform Dashboard

Frontend-only dashboard for the `Crypto-Trader-Bot` control-plane API. See `PLAN.md` for the
phase plan, `ARCHITECTURE.md` for the page map and data flow, and `CLAUDE.md` for conventions.

## Getting started

```bash
cp .env.example .env.local   # fill in NEXT_PUBLIC_API_URL + Supabase env vars
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Commands

- `npm run dev` — local dev server
- `npm run build` — production build
- `npm run lint` — ESLint
- `npm run typecheck` — `tsc --noEmit`

## Deployment

Vercel, this repo only. Set `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` per environment. No other backend knowledge is required — see
`docs/repo-topology.md`.
