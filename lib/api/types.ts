/**
 * Hand-mirrored from `Crypto-Trader-Bot`'s `src/tradingplatform/core/enums.py` and
 * `src/tradingplatform/api/schemas.py`. Keep in lockstep with that source, not with
 * assumptions — see ARCHITECTURE.md's "Deviations from the original brief" table for the
 * places this already diverged from the originally assumed contract.
 */

// -- core/enums.py --------------------------------------------------------

export type TenantStatus = "active" | "suspended";

export type MembershipRole = "owner" | "admin" | "viewer";

export type BotMode = "paper" | "live";

export type BotTier = "1" | "2" | "3";

export type BotStatus = "draft" | "running" | "paused" | "halted" | "stopped";

export type OptimizationRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed";

// -- api/schemas.py --------------------------------------------------------

export interface TenantOut {
  id: string;
  slug: string;
  plan_tier: string;
  status: TenantStatus;
  role: MembershipRole;
}

export interface BotOut {
  id: string;
  exchange_id: string;
  credential_id: string | null;
  strategy_key: string;
  strategy_version: string;
  symbol: string | null;
  timeframe: string;
  mode: BotMode;
  tier: BotTier;
  status: BotStatus;
  created_at: string;
}

export interface BotCreate {
  exchange_id: string;
  credential_id?: string | null;
  strategy_key: string;
  strategy_version: string;
  symbol?: string | null;
  timeframe: string;
  mode?: BotMode;
  tier?: BotTier;
  /** Strategy-specific params — no schema-fetch endpoint exists yet, see ARCHITECTURE.md. */
  params: Record<string, unknown>;
  initial_allocation: string;
  quote_currency?: string;
}

export interface BotStatusUpdate {
  status: BotStatus;
}

export interface BotConfigOut {
  bot_id: string;
  version: number;
  params: Record<string, unknown>;
  effective_from: string;
}

export interface BotConfigCreate {
  params: Record<string, unknown>;
  effective_from?: string | null;
}

export interface CredentialOut {
  id: string;
  exchange_id: string;
  label: string;
  is_testnet: boolean;
  permissions_verified_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface CredentialCreate {
  exchange_id: string;
  label: string;
  api_key: string;
  api_secret: string;
  is_testnet?: boolean;
}

export interface BacktestRunOut {
  id: string;
  strategy_key: string;
  params: Record<string, unknown>;
  symbol: string;
  timeframe: string;
  period_start: string;
  period_end: string;
  metrics: Record<string, unknown>;
  created_at: string;
}

export interface OptimizationRunOut {
  id: string;
  study_name: string;
  search_space: Record<string, unknown>;
  best_params: Record<string, unknown> | null;
  best_value: string | null;
  n_trials: number;
  status: OptimizationRunStatus;
  created_at: string;
}
