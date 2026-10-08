// Live HyperAgents: isolation from the simulation, secret hygiene and "Lab untouched" guards.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE = "70fddf5f17c6ed622dbb64fe08d35d5e9df9f3db";

const walk = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const src = (p) => readFileSync(p, "utf8");

const LIVE_FILES = [
  ...walk(join(ROOT, "src/lib/live")),
  ...walk(join(ROOT, "src/components/live")),
].filter((p) => /\.(ts|tsx)$/.test(p));

function resolveImport(from, spec) {
  let base;
  if (spec.startsWith("@/")) base = join(ROOT, "src", spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(from), spec);
  else return null;
  for (const c of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

function closure(entries) {
  const seen = new Set();
  const stack = [...entries];
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    for (const m of src(f).matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
      const r = resolveImport(f, m[1]);
      if (r) stack.push(r);
    }
  }
  return seen;
}

test("Live code (transitively) never imports simulation, markets, the Lab, the store or the Grok meta-agent", () => {
  assert.ok(LIVE_FILES.length >= 15, `found ${LIVE_FILES.length} live files`);
  const forbidden = [/src\/lib\/hyperagents\//, /src\/lib\/markets\//, /src\/components\/lab\//];
  for (const f of closure(LIVE_FILES)) {
    const rel = relative(ROOT, f);
    for (const re of forbidden)
      assert.ok(!re.test(rel), `Live code reaches simulation file ${rel}`);
  }
  for (const f of LIVE_FILES) {
    const text = src(f);
    for (const word of [
      /\buseLab\b/,
      /\bproposePatch\b/,
      /\bstepOnce\b/,
      /\bapplyPatchScore\b/,
      /\bselectParent\b/,
      /\bcreateRun\b/,
      /XAI_API_KEY/,
      /api\.x\.ai/,
      /from ["'][^"']*\/evolve["']/,
    ]) {
      assert.ok(!word.test(text), `${relative(ROOT, f)} matches ${word}`);
    }
  }
});

test("Live is read-only: no non-GET HTTP, no fetch outside the adapter, no control verbs", () => {
  for (const f of LIVE_FILES) {
    const rel = relative(ROOT, f);
    const text = src(f);
    assert.ok(
      !/method:\s*["'](POST|PUT|PATCH|DELETE)["']/i.test(text),
      `${rel} has a mutating method`,
    );
    if (!rel.endsWith("adapter.ts"))
      assert.ok(
        !/\bfetch\(/.test(text.replace(/fetchLive|fetchLiveFn/g, "")),
        `${rel} calls fetch directly`,
      );
    assert.ok(
      !/localStorage|sessionStorage|document\.cookie/.test(text),
      `${rel} touches browser storage`,
    );
    assert.ok(
      !/(startRun|stopRun|killRun|restartRun|selectNextParent|docker\s+(run|stop|rm|kill))/i.test(
        text,
      ),
      `${rel} has a control verb`,
    );
  }
  assert.match(src(join(ROOT, "src/lib/live/api.ts")), /createServerFn\(\{ method: "GET" \}\)/);
});

test("telemetry credentials are server-only in source", () => {
  const hits = walk(join(ROOT, "src")).filter(
    (p) => /\.(ts|tsx)$/.test(p) && /TELEMETRY_API_TOKEN|TELEMETRY_BASE_URL/.test(src(p)),
  );
  assert.deepEqual(
    hits.map((p) => relative(ROOT, p)),
    ["src/lib/live/adapter.ts"],
  );
  for (const f of walk(join(ROOT, "src")).filter((p) => /\.(ts|tsx)$/.test(p))) {
    assert.ok(!/VITE_TELEMETRY|import\.meta\.env[^;\n]*TELEMETRY/.test(src(f)), relative(ROOT, f));
  }
  const appEnv = join(ROOT, ".grok/app-env.json");
  if (existsSync(appEnv)) assert.ok(!/TELEMETRY/.test(src(appEnv)));
});

test("LAB / SIMULATION files are byte-identical to the exported baseline", (t) => {
  try {
    execFileSync("git", ["cat-file", "-e", `${BASELINE}^{commit}`], { cwd: ROOT, stdio: "ignore" });
  } catch {
    t.skip("baseline commit not available in this checkout");
    return;
  }
  const changed = execFileSync(
    "git",
    [
      "diff",
      "--name-only",
      BASELINE,
      "--",
      "src/lib/hyperagents",
      "src/lib/markets",
      "src/components/lab",
      "src/lib/auth",
      "src/routes/__root.tsx",
      "server",
      ".grok/app-env.json",
      "package-lock.json",
    ],
    { cwd: ROOT, encoding: "utf8" },
  ).trim();
  assert.equal(changed, "", `Lab/auth/platform files changed:\n${changed}`);
});

test("mode shell is the only bridge, and the index route renders it", () => {
  assert.match(src(join(ROOT, "src/routes/index.tsx")), /ModeShell/);
  const shell = src(join(ROOT, "src/components/mode-shell.tsx"));
  assert.match(shell, /LAB \/ SIMULATION/);
  assert.match(shell, /LIVE HYPERAGENTS/);
  assert.ok(!shell.includes("useLab"));
});

const STATIC = join(ROOT, ".vercel/output/static");
test("client bundle contains no telemetry credential, endpoint config, fixture data or Mac paths", (t) => {
  if (!existsSync(STATIC)) {
    t.skip("no build output; run `npm run build` first");
    return;
  }
  const files = walk(STATIC).filter((p) => /\.(js|mjs|css|html)$/.test(p));
  assert.ok(files.length > 0);
  const all = files.map((p) => [relative(ROOT, p), src(p)]);
  const banned = [
    "TELEMETRY_API_TOKEN",
    "TELEMETRY_BASE_URL",
    "LIVE_DEV_FIXTURES",
    "1eceed16ecdb6bedf9aff28389d654805f2e3ac1", // Epoch H run root: only present in fixtures
    "0361ba9cfda44e23a08f622fdfc428b92c5eec84004b258adbdfe3dd10eda5bc", // archive hash: only in fixtures
    "/Users/",
    "hyperagents-telemetry",
    ".secrets/api_token",
    "127.0.0.1:8765",
  ];
  for (const [name, text] of all)
    for (const b of banned) assert.ok(!text.includes(b), `${name} contains ${b}`);
  assert.ok(
    all.some(([, text]) => text.includes("TELEMETRY UNAVAILABLE")),
    "unavailable state is shipped to the client",
  );
});
