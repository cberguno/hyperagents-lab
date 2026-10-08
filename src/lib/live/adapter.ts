/**
 * Server-side telemetry adapter. Pure with respect to its inputs (env, fetch, clock) so it is testable.
 *
 * Rules:
 *  - GET only, to allowlisted paths built from validated requests (see endpoints.ts).
 *  - Credentials come from SERVER env only and never appear in any returned value.
 *  - Real telemetry is used whenever configured; if it fails the answer is `unavailable`.
 *  - Fixtures are served ONLY when LIVE_DEV_FIXTURES=true, NODE_ENV !== "production" and no real
 *    telemetry is configured. There is no fallback from a failed real call to fixtures.
 */
import { InvalidLiveRequest, pathFor, type LiveRequest } from "./endpoints.ts";
import { FIXTURES } from "./fixtures.ts";
import { sanitize } from "./sanitize.ts";
import { FIXTURE_LABEL, type LiveResult, type UnavailableReason } from "./types.ts";

export type LiveEnv = {
  TELEMETRY_BASE_URL?: string;
  TELEMETRY_API_TOKEN?: string;
  LIVE_DEV_FIXTURES?: string;
  NODE_ENV?: string;
};

const TIMEOUT_MS = 6000;

function unavailable(reason: UnavailableReason, now: () => Date): LiveResult<never> {
  return { status: "unavailable", fetchedAt: now().toISOString(), reason };
}

function realConfig(env: LiveEnv): { base: string; token: string } | null {
  const raw = env.TELEMETRY_BASE_URL?.trim();
  const token = env.TELEMETRY_API_TOKEN?.trim();
  if (!raw || !token) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return { base: raw.replace(/\/+$/, ""), token };
  } catch {
    return null;
  }
}

export function fixturesAllowed(env: LiveEnv): boolean {
  return env.LIVE_DEV_FIXTURES === "true" && env.NODE_ENV !== "production";
}

function fixtureFor(req: LiveRequest): unknown | undefined {
  switch (req.endpoint) {
    case "generation":
      return Object.hasOwn(FIXTURES.generation, req.id ?? "")
        ? FIXTURES.generation[req.id as string]
        : undefined;
    case "repeat":
      return Object.hasOwn(FIXTURES.repeat, req.id ?? "")
        ? FIXTURES.repeat[req.id as string]
        : undefined;
    default:
      return FIXTURES[req.endpoint];
  }
}

export async function fetchLive(
  req: LiveRequest,
  env: LiveEnv,
  doFetch: typeof fetch = fetch,
  now: () => Date = () => new Date(),
): Promise<LiveResult<unknown>> {
  const cfg = realConfig(env);
  if (!cfg) {
    if (!fixturesAllowed(env)) return unavailable("not_configured", now);
    const fx = fixtureFor(req);
    if (fx === undefined) return unavailable("not_found", now);
    return {
      status: "fixture",
      fetchedAt: now().toISOString(),
      label: FIXTURE_LABEL,
      data: sanitize(fx),
    };
  }

  let path: string;
  try {
    path = pathFor(req);
  } catch (e) {
    if (e instanceof InvalidLiveRequest) return unavailable("bad_response", now);
    throw e;
  }
  const headers: Record<string, string> = { Accept: "application/json" };
  if (req.endpoint !== "health") headers.Authorization = `Bearer ${cfg.token}`;
  try {
    const res = await doFetch(cfg.base + path, {
      method: "GET",
      headers,
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 401 || res.status === 403) return unavailable("auth_failed", now);
    if (res.status === 404) return unavailable("not_found", now);
    if (!res.ok) return unavailable("upstream_error", now);
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return unavailable("bad_response", now);
    }
    return { status: "live", fetchedAt: now().toISOString(), data: sanitize(body) };
  } catch {
    return unavailable("unreachable", now);
  }
}
