# Repo topology

This repository has **no knowledge of how or where the backend is hosted, deployed, or run.**

It knows exactly one fact about the backend: `NEXT_PUBLIC_API_URL`. It also knows how to reach
Neon Auth (`NEON_AUTH_BASE_URL`/`NEXT_PUBLIC_NEON_AUTH_URL`), because it authenticates directly
against that same Neon Auth project — the backend independently validates the tokens it issues.
Everything else about the
backend's state (is it up, is a tenant's exchange credential verified, is a circuit breaker
tripped) is learned at runtime by calling it and reacting to the response, never assumed.

This is why `/setup` (see `ARCHITECTURE.md`) is the centerpiece of the app rather than a nice-to-have
page: it's the one place that turns "we called the API and got X" into a human-readable answer to
"what is and isn't hooked up."

Deploying this repo (Vercel) requires no knowledge of the backend's deployment target beyond
setting `NEXT_PUBLIC_API_URL` per environment.
