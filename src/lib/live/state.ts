import type { ConnectionState, LiveResult } from "./types.ts";

/** A live answer older than this is shown as STALE even if nothing has failed yet (e.g. a sleeping tab). */
export const STALE_AFTER_MS = 30_000;

export type Good<T> = { status: "live" | "fixture"; fetchedAt: string; data: T };

export type View<T> = {
  state: ConnectionState;
  data: T | null;
  fetchedAt: string | null;
  reason: string | null;
};

/**
 * Combine the latest proxy answer with the last good one.
 * Unavailable never turns into simulated or fixture data: it is either STALE (we still hold real
 * earlier data, clearly labelled) or UNAVAILABLE (nothing to show).
 */
export function deriveView<T>(
  lastGood: Good<T> | null,
  latest: LiveResult<T> | undefined,
  nowMs: number,
): View<T> {
  if (latest && latest.status !== "unavailable") {
    const age = nowMs - Date.parse(latest.fetchedAt);
    const stale = latest.status === "live" && age > STALE_AFTER_MS;
    return {
      state: stale ? "stale" : latest.status,
      data: latest.data,
      fetchedAt: latest.fetchedAt,
      reason: null,
    };
  }
  const reason = latest && latest.status === "unavailable" ? latest.reason : null;
  if (lastGood) {
    return { state: "stale", data: lastGood.data, fetchedAt: lastGood.fetchedAt, reason };
  }
  return { state: "unavailable", data: null, fetchedAt: null, reason };
}
