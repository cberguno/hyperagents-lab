# HyperAgents Lab

A laboratory UI for [HyperAgents](https://github.com/facebookresearch/HyperAgents) (Meta FAIR): pick a domain, run the Darwin archive loop, inspect patches, and — on **stock trading** — score every generation with a causal close-to-close backtest. A separate **trading** domain scores a frozen n=100 snapshot file (JSON `{action,size,reasoning}`, mean P&L minus buy-and-hold) and dual-reports **paper review** transfer each generation.

Live origin: [https://hill-lark-kite-xenon.grok.me/](https://hill-lark-kite-xenon.grok.me/)

## What this repo is

Source recovered from the public Grok App Builder deployment (`hill-lark-kite-xenon`, project `01a0b789-b826-70a3-a180-af4675e50310`) and rewritten as TypeScript:

- Domain catalog (14 harnesses) and published patches
- Parent selection `score_child_prop`
- Stock-trading walk-forward (30 US mega-caps, 2016–2026 daily bars, OOS from 2019-01-02, 5 bp costs, 2% short borrow)
- Trading snapshot eval (`src/data/trading-fixtures.json`, n=100, no live API)
- Dual transfer scores on `paper_review` ↔ `trading` (paper catalog RNG is unchanged)
- Archive, equity vs SPY, loop log, Setup (optional Grok meta-agent)

Catalog domains (paper review, BALROG, Genesis, IMO, polyglot) use the published patch list plus noise. They are not the Docker HyperAgents eval. `paper_review` in `src/data/domains.json` is a frozen byte slice.

## Trading eval

The `trading` domain is not the 30-name Sharpe walk-forward. Each of 100 frozen bars gives the task agent ticker, 20-day history, volume, and a headline. The agent must emit `{action, size, reasoning}` with `action` in `buy|sell|hold` and `size` in `[0,1]`. Score is mean agent P&L minus mean buy-and-hold. Negative scores stay negative (`clipScore` is not applied). There is no Yahoo fetch and no Webull/broker path in this loop.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:8080

## Layout

```
src/
  components/     Lab UI (domain nav, archive, equity chart, setup)
  lib/            loop, backtest, trading-eval, domain catalog
  data/           domains.json, trading-fixtures.json, closes/*.json
  routes/         TanStack Start pages + /api/meta-agent
```
