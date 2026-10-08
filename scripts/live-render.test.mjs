// Server-side render of the Live presentation components with fixture props (no browser, no network).
import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { FIXTURES } from "../src/lib/live/fixtures.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let vite;
const load = (p) => vite.ssrLoadModule(p);
const text = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

before(async () => {
  vite = await createServer({
    root: ROOT,
    configFile: false,
    logLevel: "silent",
    appType: "custom",
    plugins: [react()],
    server: { middlewareMode: true },
    resolve: { tsconfigPaths: true },
  });
});
after(async () => vite?.close());

test("Reliability control: five REPEATS, Repeat 3 visibly PARTIAL with a dash for validation", async () => {
  const { ControlPanelView } = await load("/src/components/live/control-panel.tsx");
  const html = renderToStaticMarkup(createElement(ControlPanelView, { control: FIXTURES.control }));
  const t = text(html);
  assert.match(t, /FIXED-CODE EVALUATION RELIABILITY CONTROL/);
  assert.match(t, /PARTIAL/);
  assert.match(t, /Validation censored by provider failure/);
  assert.equal([...html.matchAll(/data-repeat="(\d)"/g)].map((m) => m[1]).join(""), "12345");
  assert.doesNotMatch(t, /Generation|Gen \d/);
  const row3 = html.match(/<tr[^>]*data-repeat="3".*?<\/tr>/s)[0];
  assert.match(text(row3), /Repeat 3 PARTIAL 0\.61 —/);
  const row1 = html.match(/<tr[^>]*data-repeat="1".*?<\/tr>/s)[0];
  assert.match(text(row1), /Repeat 1 COMPLETE 0\.58 0\.62/);
  assert.match(t, /0\.604/);
  assert.match(t, /0\.0195/);
  assert.match(t, /0\.625/);
  assert.match(t, /998 \/ 1007/);
});

test("Lineage: exactly the real nodes, failed ones flagged, no Gen 7", async () => {
  const { LiveLineage } = await load("/src/components/live/live-lineage.tsx");
  const html = renderToStaticMarkup(
    createElement(LiveLineage, { lineage: FIXTURES.lineage, selectedId: "6", onSelect() {} }),
  );
  const ids = [...html.matchAll(/data-node="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids.sort(), ["1", "2", "3", "4", "5", "6", "initial"]);
  assert.ok(!ids.includes("7"));
  const failed = [...html.matchAll(/data-node="([^"]+)" data-failed="true"/g)]
    .map((m) => m[1])
    .sort();
  assert.deepEqual(failed, ["1", "2", "3"]);
  assert.match(text(html), /Gen 6/);
  assert.match(text(html), /val 0\.77/);
});

test("Generation detail: nulls render as dashes, not zeros", async () => {
  const { GenerationDetailView } = await load("/src/components/live/generation-detail.tsx");
  const t = text(
    renderToStaticMarkup(createElement(GenerationDetailView, { g: FIXTURES.generation["1"] })),
  );
  assert.match(t, /full train \/ validation — \/ —/);
  assert.match(t, /staged train \/ validation 0\.00 \/ 0\.00/);
  assert.match(t, /valid_parent true/);
  const six = text(
    renderToStaticMarkup(createElement(GenerationDetailView, { g: FIXTURES.generation["6"] })),
  );
  assert.match(six, /full train \/ validation 0\.61 \/ 0\.62/);
  assert.match(six, /openai\/gpt-6-luna/);
});

test("Connection badge and unavailable panel show the required states", async () => {
  const { ConnectionBadge, UnavailablePanel } = await load(
    "/src/components/live/live-primitives.tsx",
  );
  const label = (state) => text(renderToStaticMarkup(createElement(ConnectionBadge, { state })));
  assert.match(label("live"), /LIVE/);
  assert.match(label("stale"), /STALE/);
  assert.match(label("fixture"), /DEVELOPMENT FIXTURE/);
  assert.match(label("unavailable"), /TELEMETRY UNAVAILABLE/);
  const html = renderToStaticMarkup(
    createElement(UnavailablePanel, { reason: "unreachable", what: "The overview" }),
  );
  assert.match(text(html), /TELEMETRY UNAVAILABLE/);
  assert.match(text(html), /Nothing is simulated or substituted/);
});

test("Host panel shows read-only disk/RAM/swap/Docker and no controls", async () => {
  const { HostPanelView } = await load("/src/components/live/host-panel.tsx");
  const html = renderToStaticMarkup(
    createElement(HostPanelView, { host: FIXTURES.host, docker: FIXTURES.docker }),
  );
  assert.match(text(html), /disk free/);
  assert.match(text(html), /swap used/);
  assert.match(text(html), /reachable/);
  assert.match(text(html), /9f00a85277af871a/);
  assert.doesNotMatch(html, /<button|<input|<form/);
});
