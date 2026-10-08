// Live HyperAgents: proxy allowlist, adapter behaviour, fixtures and presentation rules.
import assert from "node:assert/strict";
import test from "node:test";
import { fetchLive, fixturesAllowed } from "../src/lib/live/adapter.ts";
import { ENDPOINT_KEYS, parseRequest, pathFor } from "../src/lib/live/endpoints.ts";
import { FIXTURES } from "../src/lib/live/fixtures.ts";
import {
  CONTROL_LABEL,
  depthOf,
  generationLabel,
  presentRepeat,
  repeatLabel,
} from "../src/lib/live/present.ts";
import { sanitize } from "../src/lib/live/sanitize.ts";
import { deriveView, STALE_AFTER_MS } from "../src/lib/live/state.ts";

const BASE = "http://telemetry.internal.example:8765";
const TOKEN = "tok-SECRET-VALUE-123";
const REAL = { TELEMETRY_BASE_URL: BASE, TELEMETRY_API_TOKEN: TOKEN, NODE_ENV: "production" };
const clock = () => new Date("2026-10-08T12:00:00Z");

function mockFetch(handler) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url: String(url), init });
    return handler(String(url), init);
  };
  fn.calls = calls;
  return fn;
}
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("endpoint allowlist maps every key to exactly one fixed GET path", () => {
  const expected = {
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
  for (const [k, p] of Object.entries(expected))
    assert.equal(pathFor(parseRequest({ endpoint: k })), p);
  assert.equal(
    pathFor(parseRequest({ endpoint: "generation", id: "6" })),
    "/api/live/epoch-h/generations/6",
  );
  assert.equal(
    pathFor(parseRequest({ endpoint: "generation", id: "initial" })),
    "/api/live/epoch-h/generations/initial",
  );
  assert.equal(
    pathFor(parseRequest({ endpoint: "repeat", id: "3" })),
    "/api/live/control/repeats/3",
  );
  assert.equal(ENDPOINT_KEYS.length, 12);
});

test("arbitrary paths, unknown endpoints and bad ids are rejected", () => {
  const bad = [
    null,
    "status",
    [],
    {},
    { endpoint: "/api/live/host" },
    { endpoint: "../../etc/passwd" },
    { endpoint: "__proto__" },
    { endpoint: "constructor" },
    { endpoint: "toString" },
    { endpoint: "status", path: "/api/live/host" },
    { endpoint: "status", id: "1" },
    { endpoint: "generation" },
    { endpoint: "generation", id: "../x" },
    { endpoint: "generation", id: "6/../../host" },
    { endpoint: "generation", id: "1234" },
    { endpoint: "generation", id: "gen_6" },
    { endpoint: "generation", id: "%2e%2e" },
    { endpoint: "generation", id: 6 },
    { endpoint: "repeat", id: "0" },
    { endpoint: "repeat", id: "100" },
    { endpoint: "repeat", id: "abc" },
    { endpoint: "repeat", id: "1/../../host" },
    { endpoint: "repeat" },
    { endpoint: "POST /api/live/status" },
    { endpoint: "http://evil.example/" },
  ];
  for (const input of bad)
    assert.throws(
      () => parseRequest(input),
      /invalid live request|unknown|bad|unexpected|not accepted/i,
      JSON.stringify(input),
    );
});

test("real mode: GET only, allowlisted URL, auth header server-side, no redirects, no body", async () => {
  const f = mockFetch(() => json({ ok: true }));
  for (const key of ENDPOINT_KEYS) {
    const req =
      key === "generation"
        ? { endpoint: key, id: "4" }
        : key === "repeat"
          ? { endpoint: key, id: "2" }
          : { endpoint: key };
    const res = await fetchLive(parseRequest(req), REAL, f, clock);
    assert.equal(res.status, "live");
  }
  assert.equal(f.calls.length, ENDPOINT_KEYS.length);
  for (const c of f.calls) {
    assert.equal(c.init.method, "GET");
    assert.equal(c.init.redirect, "error");
    assert.equal(c.init.body, undefined);
    assert.ok(c.url.startsWith(BASE + "/health") || c.url.startsWith(BASE + "/api/live/"), c.url);
  }
  const health = f.calls.find((c) => c.url.endsWith("/health"));
  assert.equal(health.init.headers.Authorization, undefined);
  assert.equal(
    f.calls.find((c) => c.url.endsWith("/api/live/host")).init.headers.Authorization,
    `Bearer ${TOKEN}`,
  );
});

test("nothing returned to the browser contains the token, base URL or Mac paths", async () => {
  const outcomes = [
    mockFetch(() =>
      json({
        matching_processes: ["python /Users/cberguno/x"],
        note: "see /Users/cberguno/hyperagents-epoch-h/outputs",
        auth: `Bearer ${TOKEN}`,
      }),
    ),
    mockFetch(() => json({}, 401)),
    mockFetch(() => json({}, 404)),
    mockFetch(() => json({}, 500)),
    mockFetch(() => new Response("not json", { status: 200 })),
    mockFetch(() => {
      throw new Error(`connect ECONNREFUSED ${BASE} with ${TOKEN}`);
    }),
  ];
  for (const f of outcomes) {
    const res = await fetchLive(parseRequest({ endpoint: "integrity" }), REAL, f, clock);
    const s = JSON.stringify(res);
    assert.ok(!s.includes(TOKEN), s);
    assert.ok(!s.includes("telemetry.internal.example"), s);
    assert.ok(!s.includes("/Users/"), s);
    assert.ok(!s.includes("matching_processes"), s);
  }
});

test("failure reasons are typed and unavailable carries no data", async () => {
  const cases = [
    [401, "auth_failed"],
    [403, "auth_failed"],
    [404, "not_found"],
    [500, "upstream_error"],
    [503, "upstream_error"],
  ];
  for (const [status, reason] of cases) {
    const res = await fetchLive(
      parseRequest({ endpoint: "host" }),
      REAL,
      mockFetch(() => json({}, status)),
      clock,
    );
    assert.deepEqual(res, { status: "unavailable", fetchedAt: clock().toISOString(), reason });
  }
  const bad = await fetchLive(
    parseRequest({ endpoint: "host" }),
    REAL,
    mockFetch(() => new Response("<html>", { status: 200 })),
    clock,
  );
  assert.equal(bad.reason, "bad_response");
  const down = await fetchLive(
    parseRequest({ endpoint: "host" }),
    REAL,
    mockFetch(() => {
      throw new TypeError("fetch failed");
    }),
    clock,
  );
  assert.equal(down.reason, "unreachable");
});

test("unavailable telemetry never falls back to fixtures or simulation", async () => {
  const req = parseRequest({ endpoint: "epochH" });
  // not configured, production, no flag
  assert.equal(
    (
      await fetchLive(
        req,
        { NODE_ENV: "production" },
        mockFetch(() => assert.fail("no call")),
        clock,
      )
    ).status,
    "unavailable",
  );
  assert.equal(
    (
      await fetchLive(
        req,
        {},
        mockFetch(() => assert.fail("no call")),
        clock,
      )
    ).reason,
    "not_configured",
  );
  // flag set but production: still unavailable
  assert.equal(
    (await fetchLive(req, { LIVE_DEV_FIXTURES: "true", NODE_ENV: "production" }, undefined, clock))
      .status,
    "unavailable",
  );
  // real configured and failing, even with the fixture flag in development: unavailable, not fixture
  const dev = { ...REAL, NODE_ENV: "development", LIVE_DEV_FIXTURES: "true" };
  const failing = await fetchLive(
    req,
    dev,
    mockFetch(() => {
      throw new Error("down");
    }),
    clock,
  );
  assert.equal(failing.status, "unavailable");
  assert.equal(failing.reason, "unreachable");
  assert.ok(!("data" in failing));
  // flag value must be exactly "true"
  for (const v of ["1", "yes", "TRUE", "", undefined])
    assert.equal(fixturesAllowed({ LIVE_DEV_FIXTURES: v, NODE_ENV: "development" }), false);
});

test("fixtures are served only when explicitly enabled outside production, and are labelled", async () => {
  const env = { LIVE_DEV_FIXTURES: "true", NODE_ENV: "development" };
  const res = await fetchLive(parseRequest({ endpoint: "epochH" }), env, undefined, clock);
  assert.equal(res.status, "fixture");
  assert.equal(res.label, "DEVELOPMENT FIXTURE");
});

test("Epoch H fixture facts: latest generation 6, no Gen 7, real lineage", async () => {
  const env = { LIVE_DEV_FIXTURES: "true", NODE_ENV: "development" };
  const get = async (r) => await fetchLive(parseRequest(r), env, undefined, clock);
  const epoch = (await get({ endpoint: "epochH" })).data;
  assert.equal(epoch.latest_generation, 6);
  const ids = (await get({ endpoint: "generations" })).data.generations.map((g) => g.id);
  assert.deepEqual(ids, ["initial", "1", "2", "3", "4", "5", "6"]);
  assert.ok(!ids.includes("7"));
  const g7 = await get({ endpoint: "generation", id: "7" });
  assert.equal(g7.status, "unavailable");
  assert.equal(g7.reason, "not_found");
  const lin = (await get({ endpoint: "lineage" })).data;
  assert.deepEqual(
    new Set(lin.edges.map((e) => `${e.from}>${e.to}`)),
    new Set(["initial>1", "1>2", "initial>3", "2>4", "4>5", "5>6"]),
  );
  assert.equal(lin.root, "initial");
  assert.equal(lin.champion, "initial");
  assert.deepEqual(lin.best_evolved_validation.ids.sort(), ["4", "6"]);
  assert.equal(lin.best_evolved_validation.score, 0.62);
  const byId = Object.fromEntries(lin.nodes.map((n) => [n.id, n]));
  assert.equal(byId.initial.validation_score, 0.77);
  for (const id of ["1", "2", "3"]) {
    assert.equal(byId[id].validation_score, null); // failed generations stay visible, with no invented full score
    assert.equal(byId[id].staged_validation, 0);
  }
  assert.deepEqual([...depthOf(lin.nodes).entries()].sort(), [
    ["1", 1],
    ["2", 2],
    ["3", 1],
    ["4", 3],
    ["5", 4],
    ["6", 5],
    ["initial", 0],
  ]);
});

test("control fixtures: five repeats, Repeat 3 partial with null validation, frozen summary", async () => {
  const reps = FIXTURES.repeats.repeats;
  assert.deepEqual(
    reps.map((r) => r.repeat),
    [1, 2, 3, 4, 5],
  );
  assert.deepEqual(
    reps.map((r) => r.train_score),
    [0.58, 0.59, 0.61, 0.63, 0.61],
  );
  assert.deepEqual(
    reps.map((r) => r.validation_score),
    [0.62, 0.66, null, 0.59, 0.63],
  );
  const r3 = reps[2];
  assert.equal(r3.status, "partial");
  assert.equal(r3.validation_score, null);
  assert.equal(r3.reason, "validation censored by provider failure");
  assert.equal(r3.accept_recall.validation, null);
  assert.equal(FIXTURES.repeat["3"].validation.score, null);
  assert.equal(FIXTURES.control.label, CONTROL_LABEL);
  const s = FIXTURES.control.summary;
  assert.deepEqual(
    [
      s.train.mean_accuracy,
      s.train.sample_sd,
      s.validation.completed_sets,
      s.validation.mean_accuracy,
      s.validation.sample_sd,
    ],
    [0.604, 0.0195, 4, 0.625, 0.0289],
  );
  assert.deepEqual(
    [s.provider.successful_provider_calls, s.provider.total_provider_calls],
    [998, 1007],
  );
  for (const r of reps) assert.ok(!("generation" in r) && !("genid" in r));
});

test("presentation: Repeat 3 renders PARTIAL, validation is a dash and a chart gap; repeats are never generations", () => {
  const rows = FIXTURES.repeats.repeats.map(presentRepeat);
  const r3 = rows[2];
  assert.equal(r3.partial, true);
  assert.equal(r3.statusLabel, "PARTIAL");
  assert.equal(r3.validation, "—");
  assert.equal(r3.chart.validation, null);
  assert.match(r3.note, /censored by provider failure/);
  assert.equal(r3.title, "Repeat 3");
  assert.ok(rows.filter((r) => r.partial).length === 1);
  for (const r of rows) assert.ok(!/gen/i.test(r.title), r.title);
  assert.equal(repeatLabel(3), "Repeat 3");
  assert.equal(generationLabel("3"), "Gen 3");
  assert.equal(CONTROL_LABEL, "FIXED-CODE EVALUATION RELIABILITY CONTROL");
});

test("connection state: unavailable is never replaced by fixture data; old real data becomes STALE", () => {
  const now = Date.parse("2026-10-08T12:00:00Z");
  const unavailable = {
    status: "unavailable",
    fetchedAt: "2026-10-08T12:00:00Z",
    reason: "unreachable",
  };
  assert.deepEqual(deriveView(null, unavailable, now), {
    state: "unavailable",
    data: null,
    fetchedAt: null,
    reason: "unreachable",
  });
  assert.equal(deriveView(null, undefined, now).state, "unavailable");
  const good = { status: "live", fetchedAt: "2026-10-08T11:59:50Z", data: { a: 1 } };
  const stale = deriveView(good, unavailable, now);
  assert.equal(stale.state, "stale");
  assert.deepEqual(stale.data, { a: 1 });
  assert.equal(
    deriveView(null, { status: "live", fetchedAt: "2026-10-08T12:00:00Z", data: 1 }, now).state,
    "live",
  );
  assert.equal(
    deriveView(
      null,
      { status: "live", fetchedAt: new Date(now - STALE_AFTER_MS - 1000).toISOString(), data: 1 },
      now,
    ).state,
    "stale",
  );
  assert.equal(
    deriveView(
      null,
      {
        status: "fixture",
        label: "DEVELOPMENT FIXTURE",
        fetchedAt: "2026-10-08T12:00:00Z",
        data: 1,
      },
      now,
    ).state,
    "fixture",
  );
});

test("sanitize strips filesystem paths and bearer strings but keeps model ids", () => {
  const out = sanitize({
    a: "/Users/me/x/y.json",
    b: "run in ~/proj/z",
    c: "openrouter/z-ai/glm-5.3-flash-20260826",
    d: ["/System/Volumes/Data"],
    e: "Bearer abc.def",
    matching_processes: ["x"],
  });
  assert.deepEqual(out, {
    a: "[path]",
    b: "run in [path]",
    c: "openrouter/z-ai/glm-5.3-flash-20260826",
    d: ["[path]"],
    e: "[redacted]",
  });
});
