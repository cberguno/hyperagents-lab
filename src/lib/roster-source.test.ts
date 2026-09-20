import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { loadRosterSnapshot } from "./roster-source.server.ts";

async function writeTree(root: string) {
  const run = path.join(root, "outputs", "generate_20260920_010203");
  const gen0 = path.join(run, "gen_initial");
  const gen1 = path.join(run, "gen_1");
  await mkdir(gen0, { recursive: true });
  await mkdir(path.join(gen1, "agent_output"), { recursive: true });
  await mkdir(path.join(root, "outputs", "test_stock_trading", "eval_1"), { recursive: true });
  await writeFile(path.join(run, "archive.jsonl"), '{"current_genid":"initial"}\n{"current_genid":1}\n');
  await writeFile(
    path.join(run, "paper-desk.json"),
    JSON.stringify({
      equity: 100_412.2,
      cash: 12_000,
      startingEquity: 100_000,
      pnl: 412.2,
      positions: [{ symbol: "AAPL", qty: 10, side: "long", avgPrice: 180, currentPrice: 190, unrealizedPl: 100, marketValue: 1900 }],
      fills: [
        {
          id: "o1",
          symbol: "AAPL",
          side: "buy",
          qty: 10,
          price: 180,
          timestamp: "2026-09-18T14:30:00Z",
          realizedPl: null,
          kind: "fill",
        },
      ],
    }),
  );
  await writeFile(
    path.join(gen0, "metadata.json"),
    JSON.stringify({ current_genid: "initial", curr_patch_files: [] }),
  );
  await writeFile(path.join(gen0, "task_agent.py"), "weights = sign(mom_126) / n\n");
  await writeFile(path.join(gen0, "meta_agent.py"), "pick_next_patch()\n");
  await writeFile(
    path.join(gen1, "metadata.json"),
    JSON.stringify({
      current_genid: 1,
      curr_patch_files: ["agent_output/model_patch.diff"],
    }),
  );
  await writeFile(path.join(gen1, "agent_output", "model_patch.diff"), "--- a/task_agent.py\n+++ b/task_agent.py\n");
  await writeFile(path.join(gen1, "task_agent.py"), "weights = sign(mom_126) * vol_target\n");
  await writeFile(path.join(gen1, "meta_agent.py"), "pick_next_patch()\n");
  await writeFile(
    path.join(gen1, "report.json"),
    JSON.stringify({ sharpe_ratio: 0.41, equity: 11250.5 }),
  );
  await writeFile(
    path.join(root, "outputs", "test_stock_trading", "eval_1", "report.json"),
    JSON.stringify({ sharpe_ratio: -2.12, question_ids_evaluated: ["stock_trading_train_0"] }),
  );
  await writeFile(
    path.join(root, "outputs", "test_stock_trading", "eval_1", "notes.md"),
    "Final Portfolio Value: $9286.29\nFinal Annualized Sharpe Ratio: -2.483\n",
  );
  await writeFile(
    path.join(root, "paper-desk.json"),
    JSON.stringify({
      equity: 100_412.2,
      cash: 12_000,
      startingEquity: 100_000,
      pnl: 412.2,
      positions: [{ symbol: "AAPL", qty: 10, side: "long", avgPrice: 180, currentPrice: 190, unrealizedPl: 100, marketValue: 1900 }],
      fills: [
        {
          id: "o1",
          symbol: "AAPL",
          side: "buy",
          qty: 10,
          price: 180,
          timestamp: "2026-09-18T14:30:00Z",
          realizedPl: null,
          kind: "fill",
        },
      ],
    }),
  );
}

describe("roster archive source", () => {
  it("reads generations, balance, positions, and fills without writing", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ha-roster-"));
    process.env.HYPERAGENTS_OUTPUTS = path.join(root, "outputs");
    process.env.ROSTER_WORKSPACE_ROOT = root;
    try {
      await writeTree(root);
      const before = await readFile(path.join(root, "paper-desk.json"), "utf8");
      const snap = await loadRosterSnapshot();
      const after = await readFile(path.join(root, "paper-desk.json"), "utf8");
      assert.equal(after, before);
      assert.equal(snap.domainId, "stock_trading");
      assert.equal(snap.runId, "generate_20260920_010203");
      assert.equal(snap.generations.length, 2);
      assert.equal(snap.generations[0]?.gen, "initial");
      assert.equal(snap.generations[1]?.gen, "1");
      assert.equal(snap.generations[1]?.reward, 0.41);
      assert.equal(snap.generations[1]?.balance, 11250.5);
      assert.equal(snap.generations[1]?.taskChanged, true);
      assert.equal(snap.balance?.equity, 100_412.2);
      assert.equal(snap.positions.length, 1);
      assert.equal(snap.positions[0]?.symbol, "AAPL");
      assert.equal(snap.fills.length, 1);
      assert.equal(snap.fills[0]?.kind, "fill");
    } finally {
      await rm(root, { recursive: true, force: true });
      delete process.env.HYPERAGENTS_OUTPUTS;
      delete process.env.ROSTER_WORKSPACE_ROOT;
    }
  });

  it("exposes the archive over GET only", () => {
    const src = readFileSync(new URL("../routes/api/roster.ts", import.meta.url), "utf8");
    assert.match(src, /GET:/);
    assert.equal(src.includes("POST:"), false);
    assert.equal(src.includes("writeFile"), false);
    const server = readFileSync(new URL("./roster-source.server.ts", import.meta.url), "utf8");
    assert.equal(server.includes("writeFile"), false);
    assert.equal(server.includes("spawn("), false);
  });

  it("returns an empty read-only snapshot when no archive exists", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ha-roster-empty-"));
    process.env.HYPERAGENTS_OUTPUTS = path.join(root, "outputs");
    process.env.ROSTER_WORKSPACE_ROOT = root;
    try {
      await mkdir(path.join(root, "outputs"));
      const snap = await loadRosterSnapshot();
      assert.equal(snap.generations.length, 0);
      assert.equal(snap.positions.length, 0);
      assert.equal(snap.fills.length, 0);
      assert.ok(snap.hint);
    } finally {
      await rm(root, { recursive: true, force: true });
      delete process.env.HYPERAGENTS_OUTPUTS;
      delete process.env.ROSTER_WORKSPACE_ROOT;
    }
  });
});
