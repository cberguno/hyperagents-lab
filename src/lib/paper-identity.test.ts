import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const ROOT = new URL("../", import.meta.url);

describe("paper_review byte identity", () => {
  it("does not rewrite the paper_review object in domains.json", () => {
    const raw = readFileSync(new URL("data/domains.json", ROOT));
    const start = raw.indexOf('{"id":"paper_review"');
    const next = raw.indexOf('{"id":"search_arena"');
    assert.ok(start >= 0 && next > start);
    const slice = raw.subarray(start, next - 1);
    assert.equal(slice.length, 1511);
    assert.equal(createHash("sha256").update(slice).digest("hex").slice(0, 16), "f50b26a6fcb5e1aa");
    const catalog = JSON.parse(raw.toString("utf8")) as { id: string }[];
    assert.equal(catalog[1]?.id, "paper_review");
    assert.equal(catalog.at(-1)?.id, "trading");
  });

  it("leaves clipScore and catalogScore bodies unchanged", () => {
    const src = readFileSync(new URL("lib/loop.ts", ROOT), "utf8");
    assert.match(
      src,
      /function clipScore\(score: number, domainId: string\) \{\n  const d = DOMAIN_BY_ID\[domainId\]!;\n  return Math\.min\(d\.ceiling, Math\.max\(0\.02, score\)\);\n\}/,
    );
    assert.match(
      src,
      /function catalogScore\(state: LoopState, parent: ArchiveNode, patch: Patch\) \{\n  const domain = DOMAIN_BY_ID\[state\.domainId\]!;\n  const noise = \(nextRand\(state\) - 0\.45\) \* 0\.035;\n  const bust = nextRand\(state\) < 0\.18 \? -Math\.abs\(patch\.delta\) \* 0\.6 : 0;\n  return clipScore\(parent\.score \+ patch\.delta \* 0\.85 \+ noise \+ bust, domain\.id\);\n\}/,
    );
    assert.match(src, /score = catalogScore\(state, parent, patch\);/);
    assert.match(src, /if \(isTransferPair\(state\.domainId\)\) \{/);
    const catalogCall = src.indexOf("score = catalogScore(state, parent, patch);");
    const transfer = src.indexOf("if (isTransferPair(state.domainId))", catalogCall);
    const slice = src.slice(catalogCall, transfer);
    assert.equal(slice.includes("nextRand"), false, "transfer must not consume RNG before catalogScore returns");
  });

  it("replays the frozen paper_review archive for seed 12648430", () => {
    const catalog = JSON.parse(readFileSync(new URL("data/domains.json", ROOT), "utf8")) as {
      id: string;
      baseline: number;
      ceiling: number;
      patches: { title: string; delta: number; mutation?: unknown }[];
    }[];
    const domain = catalog.find((d) => d.id === "paper_review")!;
    const DEFAULT_SEED = 12648430;
    function mulberry(seed: number) {
      return () => {
        seed |= 0;
        seed = (seed + 1831565813) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    function clipScore(score: number, ceiling: number) {
      return Math.min(ceiling, Math.max(0.02, score));
    }
    function nextRand(state: { rng: number }) {
      let t = state.rng | 0;
      t = (t + 1831565813) | 0;
      let n = Math.imul(t ^ (t >>> 15), 1 | t);
      n = (n + Math.imul(n ^ (n >>> 7), 61 | n)) ^ n;
      state.rng = t >>> 0 || 1;
      return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
    }
    const rng = mulberry(DEFAULT_SEED);
    const score0 = clipScore(domain.baseline + (rng() - 0.5) * 0.04, domain.ceiling);
    const state = {
      rng: DEFAULT_SEED,
      usedPatches: [] as number[],
      archive: [{ id: 0, score: score0, children: 0 }],
    };
    const scores = [score0];
    const titles = ["Initial agent"];
    for (let gen = 1; gen <= 8; gen++) {
      const weights = state.archive.map((n) => Math.max(0.01, n.score + 1.5) / (1 + n.children));
      const sum = weights.reduce((a, b) => a + b, 0);
      let r = nextRand(state) * sum;
      let parent = state.archive[state.archive.length - 1]!;
      for (let i = 0; i < state.archive.length; i++) {
        r -= weights[i]!;
        if (r <= 0) {
          parent = state.archive[i]!;
          break;
        }
      }
      const unused = domain.patches
        .map((p, i) => ({ p, i }))
        .filter(({ i }) => !state.usedPatches.includes(i));
      let patch = domain.patches[0]!;
      if (unused.length === 0) {
        const i = Math.floor(nextRand(state) * domain.patches.length);
        const p = domain.patches[i]!;
        patch = { ...p, title: `${p.title} (revisit)`, delta: p.delta * 0.25 };
      } else {
        const chosen = unused[Math.floor(nextRand(state) * unused.length)]!;
        state.usedPatches.push(chosen.i);
        patch = chosen.p;
      }
      const noise = (nextRand(state) - 0.45) * 0.035;
      const bust = nextRand(state) < 0.18 ? -Math.abs(patch.delta) * 0.6 : 0;
      const score = clipScore(parent.score + patch.delta * 0.85 + noise + bust, domain.ceiling);
      parent.children += 1;
      state.archive.push({ id: gen, score, children: 0 });
      scores.push(score);
      titles.push(patch.title);
    }
    assert.deepEqual(titles, [
      "Initial agent",
      "Calibration on train split",
      "Citation grounding",
      "Structured rubric",
      "Reject-mode hedge",
      "Reject-mode hedge (revisit)",
      "Reject-mode hedge (revisit)",
      "Structured rubric (revisit)",
      "Calibration on train split (revisit)",
    ]);
    assert.equal(scores[0], 0.39084566033445295);
    assert.equal(scores[7], 0.5207974322624503);
    assert.equal(state.rng, 2788179598);
    assert.deepEqual(state.usedPatches, [2, 1, 0, 3]);
  });
});
