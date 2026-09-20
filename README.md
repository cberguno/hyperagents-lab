# HyperAgents Lab

A laboratory UI for [HyperAgents](https://github.com/facebookresearch/HyperAgents) (Meta FAIR): pick a domain, run the Darwin archive loop, inspect patches, and — on **stock trading** — score every generation with a causal close-to-close backtest.

Live origin: [https://hill-lark-kite-xenon.grok.me/](https://hill-lark-kite-xenon.grok.me/)

## What this repo is

Source recovered from the public Grok App Builder deployment (`hill-lark-kite-xenon`, project `01a0b789-b826-70a3-a180-af4675e50310`) and rewritten as TypeScript:

- Domain catalog (13 harnesses) and published patches
- Parent selection `score_child_prop`
- Stock-trading walk-forward (30 US mega-caps, 2016–2026 daily bars, OOS from 2019-01-02, 5 bp costs, 2% short borrow)
- Archive, equity vs SPY, loop log, Setup (optional Grok meta-agent)

Catalog domains (paper review, BALROG, Genesis, IMO, polyglot) use the published patch list plus noise. They are not the Docker HyperAgents eval.

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
  lib/            loop, backtest, domain catalog
  data/           domains.json + markets-panel.json (prices)
  routes/         TanStack Start pages + /api/meta-agent
```
