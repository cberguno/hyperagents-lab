import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchLiveFn } from "./api";
import type { EndpointKey } from "./endpoints";
import { deriveView, type Good, type View } from "./state";
import type { EndpointData, LiveResult } from "./types";

export const POLL_MS = 8000;
const AGE_TICK_MS = 5000;

/** Poll one telemetry endpoint through the server proxy. Never substitutes simulation or fixture data. */
export function useLive<K extends EndpointKey>(
  endpoint: K,
  id?: string,
  enabled = true,
): View<EndpointData[K]> & { loading: boolean } {
  const query = useQuery({
    queryKey: ["live", endpoint, id ?? null],
    queryFn: async () =>
      (await fetchLiveFn({ data: { endpoint, id } })) as LiveResult<EndpointData[K]>,
    enabled,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
    retry: false,
  });

  // Re-render periodically so data that stops refreshing ages into STALE.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setTick((x) => x + 1), AGE_TICK_MS);
    return () => window.clearInterval(t);
  }, []);

  const lastGood = useRef<Good<EndpointData[K]> | null>(null);
  const latest = query.data;
  if (latest && latest.status !== "unavailable") {
    lastGood.current = { status: latest.status, fetchedAt: latest.fetchedAt, data: latest.data };
  }
  // A thrown request (browser cannot reach the app server) counts as unavailable, never as data.
  const effective: LiveResult<EndpointData[K]> | undefined =
    query.isError && !latest
      ? { status: "unavailable", fetchedAt: new Date().toISOString(), reason: "unreachable" }
      : latest;
  const view = deriveView(lastGood.current, effective, Date.now());
  return { ...view, loading: query.isLoading };
}
