import { evaluate } from "@/lib/markets/engine";
import {
  applyMutation,
  BASELINE_CONFIG,
  mutationApplied,
  type EquityPt,
  type StrategyConfig,
  type TradeMetrics,
} from "@/lib/markets/types";
import { DOMAIN_BY_ID, type Domain, type DomainId, type Patch } from "./domains";

export type ArchiveNode = {
  id: number;
  gen: number;
  parentId: number | null;
  score: number;
  bestSoFar: number;
  patchTitle: string;
  patchSummary: string;
  diff: string;
  children: number;
  config?: StrategyConfig;
  metrics?: TradeMetrics;
  equity?: EquityPt[];
};

export type LogKind = "eval" | "meta" | "select" | "keep" | "system";

export type LogEntry = {
  id: string;
  gen: number;
  kind: LogKind;
  text: string;
};

export type RunState = {
  domainId: DomainId;
  maxGeneration: number;
  seed: number;
  rng: number;
  usedPatches: number[];
  archive: ArchiveNode[];
  logs: LogEntry[];
  currentGen: number;
  running: boolean;
  finished: boolean;
  grokMode: boolean;
};

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clampScore(n: number, domain: Domain) {
  return Math.min(domain.ceiling, Math.max(0.02, n));
}

function isMarkets(id: DomainId) {
  return id === "stock_trading";
}

function evalStock(cfg: StrategyConfig) {
  const result = evaluate(cfg);
  return result;
}

export function createRun(
  domainId: DomainId,
  maxGeneration = 8,
  grokMode = false,
  seed = 0xc0ffee,
): RunState {
  const domain = DOMAIN_BY_ID[domainId];
  const rand = mulberry32(seed);
  let score: number;
  let metrics: TradeMetrics | undefined;
  let equity: EquityPt[] | undefined;
  let config: StrategyConfig | undefined;
  if (isMarkets(domainId)) {
    const ev = evalStock(BASELINE_CONFIG);
    score = ev.sharpe;
    metrics = ev.metrics;
    equity = ev.equity;
    config = { ...BASELINE_CONFIG };
  } else {
    const noise = (rand() - 0.5) * 0.04;
    score = clampScore(domain.baseline + noise, domain);
  }
  const root: ArchiveNode = {
    id: 0,
    gen: 0,
    parentId: null,
    score,
    bestSoFar: score,
    patchTitle: "Initial agent",
    patchSummary: isMarkets(domainId)
      ? "Naive 6-month sign-momentum, weekly rebalance, dollar-neutral, no overlays."
      : "Unmodified task agent evaluated on the domain harness.",
    diff: isMarkets(domainId)
      ? "# baseline — domains/markets/task_agent.py\nweights = sign(mom_126) / n\nrebalance weekly"
      : "# no patch — baseline task_agent.py",
    children: 0,
    config,
    metrics,
    equity,
  };
  const logs: LogEntry[] = [
    {
      id: "log-0",
      gen: 0,
      kind: "system",
      text: isMarkets(domainId)
        ? `Archive opened on ${domain.id}. Eval is a close-to-close backtest, 30 names, OOS from ${metrics?.start ?? "2019-01-02"}. Parent selection is score_child_prop.`
        : `Archive opened on ${domain.id}. Parent selection is score_child_prop.`,
    },
    {
      id: "log-1",
      gen: 0,
      kind: "eval",
      text: isMarkets(domainId)
        ? `gen_0  sharpe=${score.toFixed(3)}  cagr=${((metrics?.cagr ?? 0) * 100).toFixed(1)}%  maxDD=${((metrics?.maxDd ?? 0) * 100).toFixed(1)}%  (baseline)`
        : `gen_0  ${domain.scoreKey}=${score.toFixed(3)}  (baseline)`,
    },
  ];
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

function nextRand(state: RunState) {
  let a = state.rng | 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  state.rng = a >>> 0 || 1;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function selectParent(state: RunState): ArchiveNode {
  const weights = state.archive.map((n) => {
    const score = Math.max(0.01, n.score + 1.5);
    return score / (1 + n.children);
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = nextRand(state) * sum;
  for (let i = 0; i < state.archive.length; i++) {
    r -= weights[i];
    if (r <= 0) return state.archive[i];
  }
  return state.archive[state.archive.length - 1];
}

export function pickPatch(state: RunState, domain: Domain, parent?: ArchiveNode): Patch {
  const remaining = domain.patches
    .map((p, i) => ({ p, i }))
    .filter(({ p, i }) => {
      if (state.usedPatches.includes(i)) return false;
      if (parent?.config && p.mutation && mutationApplied(parent.config, p.mutation)) return false;
      return true;
    });
  if (remaining.length === 0) {
    const i = Math.floor(nextRand(state) * domain.patches.length);
    const p = domain.patches[i];
    if (p.mutation?.id === "volTarget") {
      return {
        ...p,
        title: "Vol target 16%",
        summary: "Tighten the book vol target from 10% to 16%.",
        mutation: { id: "volTarget", value: 0.16 },
        delta: p.delta * 0.25,
      };
    }
    return {
      ...p,
      title: `${p.title} (revisit)`,
      delta: p.delta * 0.25,
    };
  }
  const choice = remaining[Math.floor(nextRand(state) * remaining.length)];
  state.usedPatches.push(choice.i);
  return choice.p;
}

export function applyPatchScore(
  state: RunState,
  parent: ArchiveNode,
  patch: Patch,
  domain: Domain,
) {
  const noise = (nextRand(state) - 0.45) * 0.035;
  const regress = nextRand(state) < 0.18 ? -Math.abs(patch.delta) * 0.6 : 0;
  const raw = parent.score + patch.delta * 0.85 + noise + regress;
  return clampScore(raw, domain);
}

function resolveStockPatch(patch: Patch, domain: Domain): Patch {
  if (patch.mutation) return patch;
  const hit = domain.patches.find(
    (p) => p.mutation && p.title.toLowerCase() === patch.title.toLowerCase(),
  );
  if (hit) return { ...patch, mutation: hit.mutation };
  const byWord = domain.patches.find((p) => {
    const t = patch.title.toLowerCase();
    if (!p.mutation) return false;
    if (t.includes("vol")) return p.mutation.id === "volTarget";
    if (t.includes("cost") || t.includes("hurdle")) return p.mutation.id === "costHurdle";
    if (t.includes("regime")) return p.mutation.id === "regimeFilter";
    if (t.includes("drawdown") || t.includes("breaker")) return p.mutation.id === "drawdownBreaker";
    if (t.includes("cross") || t.includes("rank") || t.includes("quintile"))
      return p.mutation.id === "crossSectional";
    if (t.includes("walk") || t.includes("ic")) return p.mutation.id === "walkForward";
    return false;
  });
  return byWord ? { ...patch, mutation: byWord.mutation } : patch;
}

export type StepResult = {
  node: ArchiveNode;
  parent: ArchiveNode;
  patch: Patch;
  kept: boolean;
};

export function stepOnce(state: RunState, overridePatch?: Patch): StepResult | null {
  if (state.currentGen >= state.maxGeneration) {
    state.finished = true;
    state.running = false;
    return null;
  }
  const domain = DOMAIN_BY_ID[state.domainId];
  const parent = selectParent(state);
  let patch = overridePatch ?? pickPatch(state, domain, parent);
  const nextGen = state.currentGen + 1;

  let score: number;
  let metrics: TradeMetrics | undefined;
  let equity: EquityPt[] | undefined;
  let config: StrategyConfig | undefined;

  if (isMarkets(state.domainId)) {
    patch = resolveStockPatch(patch, domain);
    config = applyMutation(parent.config ?? BASELINE_CONFIG, patch.mutation);
    const ev = evalStock(config);
    score = ev.sharpe;
    metrics = ev.metrics;
    equity = ev.equity;
  } else {
    score = applyPatchScore(state, parent, patch, domain);
  }

  const bestSoFar = Math.max(score, ...state.archive.map((n) => n.score));
  const node: ArchiveNode = {
    id: nextGen,
    gen: nextGen,
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
  };
  parent.children += 1;
  state.archive.push(node);
  state.currentGen = nextGen;
  const kept = score >= parent.score - 0.01;
  const stamp = (kind: LogKind, text: string) => {
    state.logs.push({
      id: `log-${state.logs.length}-${nextGen}`,
      gen: nextGen,
      kind,
      text,
    });
  };
  stamp(
    "select",
    `parent gen_${parent.id}  score=${parent.score.toFixed(3)}  children=${parent.children - 1}→${parent.children}`,
  );
  stamp("meta", `patch “${patch.title}” — ${patch.summary}`);
  if (isMarkets(state.domainId) && metrics) {
    stamp(
      "eval",
      `gen_${nextGen}  sharpe=${score.toFixed(3)}  Δ=${score - parent.score >= 0 ? "+" : ""}${(score - parent.score).toFixed(3)}  cagr=${(metrics.cagr * 100).toFixed(1)}%  maxDD=${(metrics.maxDd * 100).toFixed(1)}%`,
    );
  } else {
    stamp(
      "eval",
      `gen_${nextGen}  ${domain.scoreKey}=${score.toFixed(3)}  Δ=${(score - parent.score >= 0 ? "+" : "")}${(score - parent.score).toFixed(3)}`,
    );
  }
  stamp(
    "keep",
    kept
      ? `retained in archive  best=${bestSoFar.toFixed(3)}`
      : `retained (lineage)  best remains ${bestSoFar.toFixed(3)}`,
  );
  if (nextGen >= state.maxGeneration) {
    state.finished = true;
    state.running = false;
    stamp("system", `Run complete. ${state.archive.length} nodes in the archive.`);
  }
  return { node, parent, patch, kept };
}

export function bestNode(archive: ArchiveNode[]) {
  return archive.reduce((a, b) => (b.score > a.score ? b : a));
}

export function formatPct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

export function formatScore(domainId: DomainId, n: number) {
  if (domainId === "stock_trading") return n.toFixed(2);
  return formatPct(n);
}

export function formatLift(domainId: DomainId, n: number) {
  const sign = n >= 0 ? "+" : "";
  if (domainId === "stock_trading") return `${sign}${n.toFixed(2)}`;
  return `${sign}${formatPct(n)}`;
}
