import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { EMPTY_CONFIG, marketMeta, runBacktest } from "./backtest.ts";

describe("stock_trading panel", () => {
  it("includes NFLX closes aligned to the 30-name date index", () => {
    const meta = JSON.parse(readFileSync(new URL("../data/markets-meta.json", import.meta.url), "utf8")) as {
      dates: string[];
      tickers: string[];
    };
    const nflx = JSON.parse(readFileSync(new URL("../data/closes/NFLX.json", import.meta.url), "utf8")) as number[];
    assert.equal(meta.tickers.at(-1), "NFLX");
    assert.equal(meta.tickers.length, 30);
    assert.equal(meta.dates.length, 2692);
    assert.equal(meta.dates[0], "2016-01-04");
    assert.equal(meta.dates.at(-1), "2026-09-17");
    assert.equal(nflx.length, meta.dates.length);
    assert.ok(nflx.every((x) => typeof x === "number" && Number.isFinite(x) && x > 0));
  });

  it("runs the close-to-close eval without throwing", () => {
    const market = marketMeta();
    assert.equal(market.names, 30);
    assert.equal(market.oos, "2019-01-02");
    const result = runBacktest(EMPTY_CONFIG);
    assert.ok(Number.isFinite(result.sharpe));
    assert.equal(result.metrics.start, "2019-01-02");
    assert.equal(result.metrics.end, "2026-09-17");
    assert.ok(result.metrics.nDays > 1000);
    assert.ok(result.equity.length > 10);
  });
});
