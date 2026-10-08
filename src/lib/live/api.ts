import { createServerFn } from "@tanstack/react-start";
import { parseRequest } from "./endpoints";
import type { LiveResult } from "./types";

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/**
 * Browser-callable, server-executed telemetry read. The browser sends only an endpoint key and an
 * optional validated id. The adapter (loaded dynamically so it, the fixtures and the env access stay
 * server-side) reads TELEMETRY_* from the server environment.
 */
export const fetchLiveFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => parseRequest(input))
  .handler(async ({ data }) => {
    const { fetchLive } = await import("./adapter");
    // the adapter returns sanitized JSON from the telemetry service; assert it for serialization
    return (await fetchLive(data, process.env)) as LiveResult<Json>;
  });
