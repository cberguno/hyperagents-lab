import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  EMPTY_TRADING_CONFIG,
  applyTradingMutation,
  decisionPnl,
  parseDecision,
  runTradingEval,
  tradingFixtures,
} from "./trading-eval.ts";

describe("trading fixtures", () => {
  it("are frozen n=100 with 10 names × 10 dates and 20-bar history", () => {
    const snaps = tradingFixtures();
    assert.equal(snaps.length, 100);
    assert.equal(new Set(snaps.map((s) => s.ticker)).size, 10);
    assert.equal(new Set(snaps.map((s) => s.date)).size, 10);
    assert.ok(snaps.every((s) => s.prices.length === 20));
    assert.equal(snaps[0]!.ticker, "AAPL");
    assert.equal(snaps[0]!.date, "2019-08-01");
    assert.equal(snaps[0]!.nextReturn, -0.021159);
  });

  it("do not change bytes under the eval", () => {
    const raw = readFileSync(new URL("../data/trading-fixtures.json", import.meta.url));
    const sha = createHash("sha256").update(raw).digest("hex");
    assert.equal(raw.length, 31255);
    assert.equal(sha, "4bf6cad5c56bca5d5c8c2e33247109ed7c1234ecdbeb25d19bd477832fe4c0f5");
  });
});

describe("task agent JSON", () => {
  it("parses {action,size,reasoning} and holds on invalid json", () => {
    assert.deepEqual(parseDecision('{"action":"buy","size":0.4,"reasoning":"up"}'), {
      action: "buy",
      size: 0.4,
      reasoning: "up",
    });
    assert.equal(parseDecision("not-json").action, "hold");
    assert.equal(parseDecision('{"action":"hold","size":1}').size, 0);
    assert.equal(parseDecision('{"action":"sell","size":2}').size, 1);
  });
});

describe("trading score", () => {
  it("is mean agent P&L minus buy-and-hold", () => {
    const ev = runTradingEval(EMPTY_TRADING_CONFIG);
    assert.equal(ev.n, 100);
    const snaps = tradingFixtures();
    let agent = 0;
    let bh = 0;
    for (let i = 0; i < snaps.length; i++) {
      agent += decisionPnl(ev.decisions[i]!, snaps[i]!.nextReturn);
      bh += snaps[i]!.nextReturn;
    }
    assert.ok(Math.abs(ev.agentMean - agent / 100) < 1e-15);
    assert.ok(Math.abs(ev.buyHoldMean - bh / 100) < 1e-15);
    assert.ok(Math.abs(ev.score - (ev.agentMean - ev.buyHoldMean)) < 1e-15);
  });

  it("keeps scores below the paper clipScore floor of 0.02", () => {
    const ev = runTradingEval(EMPTY_TRADING_CONFIG);
    assert.ok(ev.score < 0.02, `score ${ev.score} would be clipped if clipScore ran`);
    const allBuy = decisionPnl({ action: "buy", size: 1, reasoning: "" }, ev.buyHoldMean);
    assert.ok(allBuy - ev.buyHoldMean === 0);
    assert.equal(decisionPnl({ action: "buy", size: 1, reasoning: "" }, -0.05), -0.05);
  });

  it("can go negative versus buy-and-hold", () => {
    const snaps = tradingFixtures();
    let agent = 0;
    let bh = 0;
    for (const s of snaps) {
      const decision =
        s.nextReturn >= 0
          ? { action: "sell" as const, size: 1, reasoning: "fade" }
          : { action: "buy" as const, size: 1, reasoning: "chase-down" };
      agent += decisionPnl(decision, s.nextReturn);
      bh += s.nextReturn;
    }
    const score = agent / snaps.length - bh / snaps.length;
    assert.ok(score < 0, `anti-BH score ${score} should stay negative`);
  });

  it("is deterministic and has no live fetch", () => {
    const g = globalThis as { fetch?: typeof fetch };
    const orig = g.fetch;
    g.fetch = (() => {
      throw new Error("live fetch is forbidden in the trading eval");
    }) as typeof fetch;
    try {
      const a = runTradingEval(EMPTY_TRADING_CONFIG);
      const b = runTradingEval(EMPTY_TRADING_CONFIG);
      assert.equal(a.score, b.score);
      const scaled = runTradingEval(applyTradingMutation(EMPTY_TRADING_CONFIG, { id: "sizeScale", value: 0.6 }));
      assert.notEqual(scaled.score, a.score);
    } finally {
      g.fetch = orig;
    }
  });
});
