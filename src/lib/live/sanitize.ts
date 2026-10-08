/** Strip Mac filesystem paths (and bearer-looking strings) from anything returned to the browser. */
const DROP_KEYS = new Set(["matching_processes"]);
const PATH_RE =
  /(?:~|\/(?:Users|System|Volumes|private|tmp|var|etc|opt|home|usr|bin|Library|Applications))(?:\/[^\s"'`,;)]*)?/g;
const BEARER_RE = /bearer\s+[A-Za-z0-9._~+/=-]+/gi;

export function sanitize<T>(value: T): T {
  return walk(value) as T;
}

function walk(v: unknown): unknown {
  if (typeof v === "string") return v.replace(BEARER_RE, "[redacted]").replace(PATH_RE, "[path]");
  if (Array.isArray(v)) return v.map(walk);
  if (v !== null && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (DROP_KEYS.has(k)) continue;
      out[k] = walk(val);
    }
    return out;
  }
  return v;
}
