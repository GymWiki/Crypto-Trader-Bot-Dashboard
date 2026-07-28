/**
 * Every backend call resolves to exactly one of these — no caller ever catches a bare `Error`
 * and has to guess what went wrong. See ARCHITECTURE.md's "`ApiResult` — adapted to the real
 * error shapes" section for why this differs from the brief's originally assumed shape (no
 * `business_error.code` — the backend's `PlatformError` handler only ever sends a message).
 */
export type ApiResult<T> =
  | { kind: "success"; data: T }
  | { kind: "network_error"; message: string }
  | { kind: "unauthorized" }
  | { kind: "forbidden" }
  | { kind: "not_found" }
  | { kind: "validation_error"; fields: Record<string, string> }
  | { kind: "business_error"; message: string }
  | { kind: "server_error"; status: number; message: string };

export function isSuccess<T>(
  result: ApiResult<T>,
): result is { kind: "success"; data: T } {
  return result.kind === "success";
}
