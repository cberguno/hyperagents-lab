/**
 * Fixed allowlist of telemetry endpoints. The client chooses an endpoint KEY (plus an optional,
 * validated id), never a path. Everything here is GET-only; there is no mutation endpoint.
 */
export const ENDPOINT_KEYS = [
  "health",
  "status",
  "epochH",
  "generations",
  "generation",
  "lineage",
  "control",
  "repeats",
  "repeat",
  "host",
  "docker",
  "integrity",
] as const;

export type EndpointKey = (typeof ENDPOINT_KEYS)[number];

const STATIC_PATHS: Record<string, string> = {
  health: "/health",
  status: "/api/live/status",
  epochH: "/api/live/epoch-h",
  generations: "/api/live/epoch-h/generations",
  lineage: "/api/live/epoch-h/lineage",
  control: "/api/live/control",
  repeats: "/api/live/control/repeats",
  host: "/api/live/host",
  docker: "/api/live/docker",
  integrity: "/api/live/integrity",
};

const GENERATION_ID = /^(initial|[0-9]{1,3})$/;
const REPEAT_ID = /^[1-9][0-9]?$/;

export type LiveRequest = { endpoint: EndpointKey; id?: string };

export class InvalidLiveRequest extends Error {
  constructor(message = "invalid live request") {
    super(message);
    this.name = "InvalidLiveRequest";
  }
}

/** Validate untrusted client input. Throws InvalidLiveRequest; never builds a path from client text. */
export function parseRequest(input: unknown): LiveRequest {
  if (typeof input !== "object" || input === null || Array.isArray(input))
    throw new InvalidLiveRequest();
  const rec = input as Record<string, unknown>;
  for (const k of Object.keys(rec)) {
    if (k !== "endpoint" && k !== "id") throw new InvalidLiveRequest("unexpected field");
  }
  const endpoint = rec.endpoint;
  if (typeof endpoint !== "string" || !(ENDPOINT_KEYS as readonly string[]).includes(endpoint)) {
    throw new InvalidLiveRequest("unknown endpoint");
  }
  const key = endpoint as EndpointKey;
  const id = rec.id;
  if (key === "generation") {
    if (typeof id !== "string" || !GENERATION_ID.test(id))
      throw new InvalidLiveRequest("bad generation id");
    return { endpoint: key, id };
  }
  if (key === "repeat") {
    if (typeof id !== "string" || !REPEAT_ID.test(id))
      throw new InvalidLiveRequest("bad repeat id");
    return { endpoint: key, id };
  }
  if (id !== undefined && id !== null) throw new InvalidLiveRequest("id not accepted here");
  return { endpoint: key };
}

/** Allowlisted upstream path for an already-validated request. */
export function pathFor(req: LiveRequest): string {
  if (req.endpoint === "generation") return `/api/live/epoch-h/generations/${req.id}`;
  if (req.endpoint === "repeat") return `/api/live/control/repeats/${req.id}`;
  const p = STATIC_PATHS[req.endpoint];
  if (!p) throw new InvalidLiveRequest("unknown endpoint");
  return p;
}
