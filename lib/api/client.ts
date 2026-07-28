import type { ApiResult } from "./result";

export interface RequestAuth {
  accessToken?: string | null;
  tenantId?: string | null;
}

export interface ApiRequestOptions extends Omit<RequestInit, "headers"> {
  headers?: HeadersInit;
  auth?: RequestAuth;
  /**
   * `GET /tenants` is the one route that must omit `X-Tenant-Id` — it's the bootstrap call used
   * to discover which tenant ids the caller may even send in that header. Every other resource
   * call needs it, so this defaults to true.
   */
  withTenant?: boolean;
}

export function getApiBaseUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url || url.trim().length === 0) return null;
  return url.replace(/\/+$/, "");
}

/**
 * FastAPI's native request-validation 422 shape is `{"detail": [{"loc": [...], "msg", "type"}]}`
 * — `loc`'s first element is always the parameter source ("body"/"query"/"path"), which is noise
 * for a form-field error map, so it's dropped; the rest is dotted into a field key.
 */
function extractValidationFields(body: unknown): Record<string, string> {
  const fields: Record<string, string> = {};
  if (
    body &&
    typeof body === "object" &&
    "detail" in body &&
    Array.isArray((body as { detail: unknown }).detail)
  ) {
    for (const entry of (body as { detail: unknown[] }).detail) {
      if (
        entry &&
        typeof entry === "object" &&
        "loc" in entry &&
        Array.isArray((entry as { loc: unknown }).loc)
      ) {
        const loc = (entry as { loc: unknown[] }).loc.map(String);
        const key = loc.slice(1).join(".") || loc.join(".") || "root";
        const msg =
          "msg" in entry ? String((entry as { msg: unknown }).msg) : "Invalid value.";
        fields[key] = msg;
      }
    }
  }
  return fields;
}

/** Domain `PlatformError`s (`api/main.py::platform_error_handler`) send `{"detail": "<message>"}`. */
function extractDetailMessage(body: unknown): string | undefined {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
  }
  return undefined;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiResult<T>> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    return {
      kind: "network_error",
      message: "NEXT_PUBLIC_API_URL is not set.",
    };
  }

  const { auth, withTenant = true, headers, ...init } = options;
  const requestHeaders = new Headers(headers);
  requestHeaders.set("Accept", "application/json");
  if (init.body !== undefined && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }
  if (auth?.accessToken) {
    requestHeaders.set("Authorization", `Bearer ${auth.accessToken}`);
  }
  if (withTenant && auth?.tenantId) {
    requestHeaders.set("X-Tenant-Id", auth.tenantId);
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: requestHeaders,
    });
  } catch (err) {
    return {
      kind: "network_error",
      message:
        err instanceof Error
          ? err.message
          : "The request could not be sent — the backend may be unreachable.",
    };
  }

  if (response.status === 204) {
    return { kind: "success", data: undefined as T };
  }

  const rawText = await response.text();
  let body: unknown;
  if (rawText.length > 0) {
    try {
      body = JSON.parse(rawText);
    } catch {
      body = undefined;
    }
  }

  if (response.ok) {
    return { kind: "success", data: body as T };
  }

  switch (response.status) {
    case 401:
      return { kind: "unauthorized" };
    case 403:
      return { kind: "forbidden" };
    case 404:
      return { kind: "not_found" };
    case 422:
      return { kind: "validation_error", fields: extractValidationFields(body) };
    case 400:
    case 409:
      return {
        kind: "business_error",
        message:
          extractDetailMessage(body) ?? `Request failed with status ${response.status}.`,
      };
    default:
      return {
        kind: "server_error",
        status: response.status,
        message:
          extractDetailMessage(body) ??
          (rawText.slice(0, 500) || `Request failed with status ${response.status}.`),
      };
  }
}
