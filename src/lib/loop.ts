import { DOMAIN_BY_ID, isStockTrading, isTrading, isTransferPair } from "./domains";
import {
  EMPTY_CONFIG,
  applyMutation,
  hasMutation,
  runBacktest,
} from "./backtest";
import {
  EMPTY_TRADING_CONFIG,
  applyTradingMutation,
  hasTradingMutation,
  paperExpectedFromTrading,
  runTradingEval,
  tradingConfigFromPaperPatch,
  type TradingConfig,
} from "./trading-eval";
import type { ArchiveNode, LoopLog, LoopState, Patch } from "./types";

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

function clipScore(score: number, domainId: string) {
  const d = DOMAIN_BY_ID[domainId]!;
  return Math.min(d.ceiling, Math.max(0.02, score));
}

function nextRand(state: LoopState) {
  let t = state.rng | 0;
  t = (t + 1831565813) | 0;
  let n = Math.imul(t ^ (t >>> 15), 1 | t);
  n = (n + Math.imul(n ^ (n >>> 7), 61 | n)) ^ n;
  state.rng = t >>> 0 || 1;
  return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
}

export function openArchive(
  domainId: string,
  maxGeneration = 8,
  grokMode = false,
  seed = DEFAULT_SEED,
): LoopState {
  const domain = DOMAIN_BY_ID[domainId]!;
  const rng = mulberry(seed);
  let score: number;
  let metrics;
  let equity;
  let config;
  let tradingConfig: TradingConfig | undefined;
  let transferScore: number | undefined;
  let transferDomain: string | undefined;
  if (isStockTrading(domainId)) {
    const bt = runBacktest(EMPTY_CONFIG);
    score = bt.sharpe;
    metrics = bt.metrics;
    equity = bt.equity;
    config = { ...EMPTY_CONFIG };
  } else if (isTrading(domainId)) {
    tradingConfig = { ...EMPTY_TRADING_CONFIG };
    const ev = runTradingEval(tradingConfig);
    score = ev.score;
    const paper = DOMAIN_BY_ID["paper_review"]!;
    transferScore = paper.baseline;
    transferDomain = "paper_review";
  } else {
    score = clipScore(domain.baseline + (rng() - 0.5) * 0.04, domainId);
    if (isTransferPair(domainId)) {
      tradingConfig = { ...EMPTY_TRADING_CONFIG };
      transferScore = runTradingEval(tradingConfig).score;
      transferDomain = "trading";
    }
  }
  const root: ArchiveNode = {
    id: 0,
    gen: 0,
    parentId: null,
    score,
    bestSoFar: score,
    patchTitle: "Initial agent",
    patchSummary: isStockTrading(domainId)
      ? "Naive 6-month sign-momentum, weekly rebalance, dollar-neutral, no overlays."
      : isTrading(domainId)
        ? "Heuristic task agent on frozen n=100 snapshots. Emits JSON {action,size,reasoning}."
        : "Unmodified task agent evaluated on the domain harness.",
    diff: isStockTrading(domainId)
      ? "# baseline — domains/markets/task_agent.py\nweights = sign(mom_126) / n\nrebalance weekly"
      : isTrading(domainId)
        ? "# baseline — domains/trading/task_agent.py\nsignal = momentum(prices)\nreturn {action, size, reasoning}"
        : "# no patch — baseline task_agent.py",
    children: 0,
    config,
    metrics,
    equity,
    tradingConfig,
    transferScore,
    transferDomain,
  };
  const logs: LoopLog[] = [
    {
      id: "log-0",
      gen: 0,
      kind: "system",
      text: isStockTrading(domainId)
        ? `Archive opened on ${domain.id}. Eval is a close-to-close backtest, 30 names, OOS from ${metrics?.start ?? "2019-01-02"}. Parent selection is score_child_prop.`
        : isTrading(domainId)
          ? `Archive opened on ${domain.id}. Eval is frozen n=100 snapshots. Score is mean P&L minus buy-and-hold. Parent selection is score_child_prop.`
          : `Archive opened on ${domain.id}. Parent selection is score_child_prop.`,
    },
    {
      id: "log-1",
      gen: 0,
      kind: "eval",
      text: isStockTrading(domainId)
        ? `gen_0  sharpe=${score.toFixed(3)}  cagr=${((metrics?.cagr ?? 0) * 100).toFixed(1)}%  maxDD=${((metrics?.maxDd ?? 0) * 100).toFixed(1)}%  (baseline)`
        : `gen_0  ${domain.scoreKey}=${score.toFixed(isTrading(domainId) ? 6 : 3)}  (baseline)`,
    },
  ];
  if (transferScore != null && transferDomain) {
    const other = DOMAIN_BY_ID[transferDomain]!;
    logs.push({
      id: "log-1b",
      gen: 0,
      kind: "eval",
      text: `transfer  ${other.id} ${other.scoreKey}=${transferScore.toFixed(transferDomain === "trading" ? 6 : 3)}`,
    });
  }
  return {
    domainId,
    maxGeneration,
    seed,
    rng: seed,
    usedPatches: [],
    archive: [root],
    logs,
    currentGen: 0,
    running: false,
    finished: false,
    grokMode,
  };
}

function pickParent(state: LoopState) {
  const weights = state.archive.map((n) => Math.max(0.01, n.score + 1.5) / (1 + n.children));
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = nextRand(state) * sum;
  for (let i = 0; i < state.archive.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return state.archive[i]!;
  }
  return state.archive[state.archive.length - 1]!;
}

function pickPatch(state: LoopState, parent: ArchiveNode): Patch {
  const domain = DOMAIN_BY_ID[state.domainId]!;
  const unused = domain.patches
    .map((p, i) => ({ p, i }))
    .filter(
      ({ p, i }) =>
        !(
          state.usedPatches.includes(i) ||
          (parent.config && p.mutation && hasMutation(parent.config, p.mutation)) ||
          (parent.tradingConfig && p.mutation && hasTradingMutation(parent.tradingConfig, p.mutation))
        ),
    );
  if (unused.length === 0) {
    const i = Math.floor(nextRand(state) * domain.patches.length);
    const p = domain.patches[i]!;
    if (p.mutation?.id === "volTarget") {
      return {
        ...p,
        title: "Vol target 16%",
        summary: "Tighten the book vol target from 10% to 16%.",
        mutation: { id: "volTarget", value: 0.16 },
        delta: p.delta * 0.25,
      };
    }
    return { ...p, title: `${p.title} (revisit)`, delta: p.delta * 0.25 };
  }
  const chosen = unused[Math.floor(nextRand(state) * unused.length)]!;
  state.usedPatches.push(chosen.i);
  return chosen.p;
}

function bindMutation(patch: Patch, domainId: string): Patch {
  const domain = DOMAIN_BY_ID[domainId]!;
  if (patch.mutation) return patch;
  const exact = domain.patches.find(
    (p) => p.mutation && p.title.toLowerCase() === patch.title.toLowerCase(),
  );
  if (exact) return { ...patch, mutation: exact.mutation };
  const title = patch.title.toLowerCase();
  const fuzzy = domain.patches.find((p) => {
    if (!p.mutation) return false;
    if (title.includes("vol")) return p.mutation.id === "volTarget";
    if (title.includes("cost") || title.includes("hurdle")) return p.mutation.id === "costHurdle";
    if (title.includes("regime")) return p.mutation.id === "regimeFilter";
    if (title.includes("drawdown") || title.includes("breaker")) return p.mutation.id === "drawdownBreaker";
    if (title.includes("cross") || title.includes("rank") || title.includes("quintile"))
      return p.mutation.id === "crossSectional";
    if (title.includes("walk") || title.includes("ic")) return p.mutation.id === "walkForward";
    return false;
  });
  return fuzzy ? { ...patch, mutation: fuzzy.mutation } : patch;
}

function catalogScore(state: LoopState, parent: ArchiveNode, patch: Patch) {
  const domain = DOMAIN_BY_ID[state.domainId]!;
  const noise = (nextRand(state) - 0.45) * 0.035;
  const bust = nextRand(state) < 0.18 ? -Math.abs(patch.delta) * 0.6 : 0;
  return clipScore(parent.score + patch.delta * 0.85 + noise + bust, domain.id);
}

export function stepGeneration(state: LoopState, forced?: Patch) {
  if (state.currentGen >= state.maxGeneration) {
    state.finished = true;
    state.running = false;
    return null;
  }
  const domain = DOMAIN_BY_ID[state.domainId]!;
  const parent = pickParent(state);
  let patch = forced ?? pickPatch(state, parent);
  const gen = state.currentGen + 1;
  let score: number;
  let metrics;
  let equity;
  let config;
  let tradingConfig: TradingConfig | undefined;
  let transferScore: number | undefined;
  let transferDomain: string | undefined;
  if (isStockTrading(state.domainId)) {
    patch = bindMutation(patch, state.domainId);
    config = applyMutation(parent.config ?? EMPTY_CONFIG, patch.mutation);
    const bt = runBacktest(config);
    score = bt.sharpe;
    metrics = bt.metrics;
    equity = bt.equity;
  } else if (isTrading(state.domainId)) {
    if (!patch.mutation) {
      const exact = domain.patches.find((p) => p.title.toLowerCase() === patch.title.toLowerCase());
      if (exact?.mutation) patch = { ...patch, mutation: exact.mutation };
    }
    tradingConfig = applyTradingMutation(parent.tradingConfig ?? EMPTY_TRADING_CONFIG, patch.mutation);
    score = runTradingEval(tradingConfig).score;
    const paper = DOMAIN_BY_ID["paper_review"]!;
    transferScore = paperExpectedFromTrading(tradingConfig, paper.baseline, paper.ceiling);
    transferDomain = "paper_review";
  } else {
    score = catalogScore(state, parent, patch);
    if (isTransferPair(state.domainId)) {
      tradingConfig = tradingConfigFromPaperPatch(parent.tradingConfig ?? EMPTY_TRADING_CONFIG, patch.title);
      transferScore = runTradingEval(tradingConfig).score;
      transferDomain = "trading";
    }
  }
  const bestSoFar = Math.max(score, ...state.archive.map((n) => n.score));
  const node: ArchiveNode = {
    id: gen,
    gen,
    parentId: parent.id,
    score,
    bestSoFar,
    patchTitle: patch.title,
    patchSummary: patch.summary,
    diff: patch.diff,
    children: 0,
    config,
    metrics,
    equity,
    tradingConfig,
    transferScore,
    transferDomain,
  };
  parent.children += 1;
  state.archive.push(node);
  state.currentGen = gen;
  const kept = score >= parent.score - 0.01;
  const log = (kind: LoopLog["kind"], text: string) => {
    state.logs.push({ id: `log-${state.logs.length}-${gen}`, gen, kind, text });
  };
  log("select", `parent gen_${parent.id}  score=${parent.score.toFixed(3)}  children=${parent.children - 1}→${parent.children}`);
  log("meta", `patch “${patch.title}” — ${patch.summary}`);
  if (isStockTrading(state.domainId) && metrics) {
    const d = score - parent.score;
    log(
      "eval",
      `gen_${gen}  sharpe=${score.toFixed(3)}  Δ=${d >= 0 ? "+" : ""}${d.toFixed(3)}  cagr=${(metrics.cagr * 100).toFixed(1)}%  maxDD=${(metrics.maxDd * 100).toFixed(1)}%`,
    );
  } else {
    const d = score - parent.score;
    const digits = isTrading(state.domainId) ? 6 : 3;
    log(
      "eval",
      `gen_${gen}  ${domain.scoreKey}=${score.toFixed(digits)}  Δ=${d >= 0 ? "+" : ""}${d.toFixed(digits)}`,
    );
  }
  if (transferScore != null && transferDomain) {
    const other = DOMAIN_BY_ID[transferDomain]!;
    log(
      "eval",
      `transfer  ${other.id} ${other.scoreKey}=${transferScore.toFixed(transferDomain === "trading" ? 6 : 3)}`,
    );
  }
  log("keep", kept ? `retained in archive  best=${bestSoFar.toFixed(3)}` : `retained (lineage)  best remains ${bestSoFar.toFixed(3)}`);
  if (gen >= state.maxGeneration) {
    state.finished = true;
    state.running = false;
    log("system", `Run complete. ${state.archive.length} nodes in the archive.`);
  }
  return { node, parent, patch, kept };
}

export function champion(archive: ArchiveNode[]) {
  return archive.reduce((best, n) => (n.score > best.score ? n : best));
}
