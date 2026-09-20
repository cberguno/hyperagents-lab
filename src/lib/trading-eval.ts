import fixtures from "../data/trading-fixtures.json" with { type: "json" };
import type { Mutation } from "./types";

export type TradeAction = "buy" | "sell" | "hold";

export type TradeDecision = {
  action: TradeAction;
  size: number;
  reasoning: string;
};

export type TradingConfig = {
  reversion: boolean;
  headlineTilt: number;
  tradeHurdle: number;
  sizeScale: number;
  policyBlend: number;
};

export type TradingSnapshot = {
  id: number;
  ticker: string;
  date: string;
  prices: number[];
  volume: number;
  headline: string;
  nextReturn: number;
};

export type TradingEvalResult = {
  n: number;
  score: number;
  agentMean: number;
  buyHoldMean: number;
  decisions: TradeDecision[];
};

export const EMPTY_TRADING_CONFIG: TradingConfig = {
  reversion: false,
  headlineTilt: 0,
  tradeHurdle: 0,
  sizeScale: 1,
  policyBlend: 0,
};

export const TRADING_FIXTURE_N = 100;

const POSITIVE = [
  "beat",
  "stronger",
  "high",
  "growth",
  "rebound",
  "expand",
  "firm",
  "climb",
  "improve",
  "record",
  "demand",
  "sold out",
  "lifts",
  "raises",
  "resilient",
  "ahead",
  "steady",
  "recover",
  "hits",
  "up",
];

const NEGATIVE = [
  "miss",
  "slow",
  "disappoint",
  "trim",
  "warn",
  "recall",
  "fine",
  "lag",
  "noise",
  "delay",
  "controversy",
  "weak",
  "drag",
  "cut",
  "soft",
  "pressure",
  "cool",
  "heavy",
  "pressured",
];

export const PAPER_PATCH_TO_TRADING: Record<string, Mutation> = {
  "Structured rubric": { id: "policyBlend", value: 0.5 },
  "Citation grounding": { id: "tradeHurdle", value: 0.015 },
  "Calibration on train split": { id: "sizeScale", value: 0.65 },
  "Reject-mode hedge": { id: "headlineTilt", value: 1 },
};

export function tradingFixtures(): TradingSnapshot[] {
  return fixtures.snapshots as TradingSnapshot[];
}

export function applyTradingMutation(cfg: TradingConfig, m?: Mutation): TradingConfig {
  if (!m) return { ...cfg };
  const next = { ...cfg };
  switch (m.id) {
    case "policyReversion":
      next.reversion = true;
      break;
    case "headlineTilt":
      next.headlineTilt = m.value ?? 1;
      break;
    case "tradeHurdle":
      next.tradeHurdle = m.value ?? 0.015;
      break;
    case "sizeScale":
      next.sizeScale = m.value ?? 0.6;
      break;
    case "policyBlend":
      next.policyBlend = m.value ?? 0.5;
      break;
    default:
      break;
  }
  return next;
}

export function hasTradingMutation(cfg: TradingConfig, m?: Mutation) {
  if (!m) return false;
  switch (m.id) {
    case "policyReversion":
      return cfg.reversion;
    case "headlineTilt":
      return cfg.headlineTilt > 0;
    case "tradeHurdle":
      return cfg.tradeHurdle > 0;
    case "sizeScale":
      return cfg.sizeScale !== 1;
    case "policyBlend":
      return cfg.policyBlend > 0;
    default:
      return false;
  }
}

export function paperTitleKey(title: string) {
  return title.replace(/ \(revisit\)$/, "");
}

export function tradingConfigFromPaperPatch(parent: TradingConfig, title: string): TradingConfig {
  const mapped = PAPER_PATCH_TO_TRADING[paperTitleKey(title)];
  return applyTradingMutation(parent, mapped);
}

function headlineScore(headline: string) {
  const t = headline.toLowerCase();
  let s = 0;
  for (const w of POSITIVE) if (t.includes(w)) s += 1;
  for (const w of NEGATIVE) if (t.includes(w)) s -= 1;
  return Math.max(-1, Math.min(1, s / 2));
}

function momentum(prices: number[]) {
  const a = prices[0]!;
  const b = prices[prices.length - 1]!;
  if (!(a > 0)) return 0;
  return b / a - 1;
}

export function decideSnapshot(snap: TradingSnapshot, cfg: TradingConfig): TradeDecision {
  const mom = momentum(snap.prices);
  const head = headlineScore(snap.headline);
  const signedMom = cfg.reversion ? -mom : mom;
  const blend = Math.max(0, Math.min(1, cfg.policyBlend));
  let signal = (1 - blend) * signedMom + blend * head;
  if (cfg.headlineTilt > 0) signal += 0.35 * cfg.headlineTilt * head;
  const mag = Math.abs(signal);
  if (mag < cfg.tradeHurdle) {
    return { action: "hold", size: 0, reasoning: `hurdle ${cfg.tradeHurdle} holds ${snap.ticker}` };
  }
  const size = Math.max(0, Math.min(1, mag * 8 * cfg.sizeScale));
  if (signal > 0) {
    return {
      action: "buy",
      size,
      reasoning: `long ${snap.ticker} signal=${signal.toFixed(4)}`,
    };
  }
  if (signal < 0) {
    return {
      action: "sell",
      size,
      reasoning: `short ${snap.ticker} signal=${signal.toFixed(4)}`,
    };
  }
  return { action: "hold", size: 0, reasoning: `flat ${snap.ticker}` };
}

export function parseDecision(raw: string): TradeDecision {
  try {
    const v = JSON.parse(raw) as Partial<TradeDecision>;
    const action: TradeAction =
      v.action === "buy" || v.action === "sell" || v.action === "hold" ? v.action : "hold";
    const size = action === "hold" ? 0 : Math.max(0, Math.min(1, Number(v.size) || 0));
    const reasoning = typeof v.reasoning === "string" ? v.reasoning : "";
    return { action, size, reasoning };
  } catch {
    return { action: "hold", size: 0, reasoning: "invalid json" };
  }
}

export function decisionPnl(decision: TradeDecision, nextReturn: number) {
  if (decision.action === "buy") return decision.size * nextReturn;
  if (decision.action === "sell") return -decision.size * nextReturn;
  return 0;
}

export function runTradingEval(cfg: TradingConfig = EMPTY_TRADING_CONFIG): TradingEvalResult {
  const snaps = tradingFixtures();
  const decisions: TradeDecision[] = [];
  let agentSum = 0;
  let bhSum = 0;
  for (const snap of snaps) {
    const decision = parseDecision(JSON.stringify(decideSnapshot(snap, cfg)));
    decisions.push(decision);
    agentSum += decisionPnl(decision, snap.nextReturn);
    bhSum += snap.nextReturn;
  }
  const n = snaps.length;
  const agentMean = agentSum / n;
  const buyHoldMean = bhSum / n;
  return {
    n,
    score: agentMean - buyHoldMean,
    agentMean,
    buyHoldMean,
    decisions,
  };
}

export function paperExpectedFromTrading(cfg: TradingConfig, baseline: number, ceiling: number) {
  let delta = 0;
  if (cfg.policyBlend > 0) delta += 0.09;
  if (cfg.tradeHurdle > 0) delta += 0.07;
  if (cfg.sizeScale !== 1) delta += 0.05;
  if (cfg.headlineTilt > 0) delta += 0.04;
  return Math.min(ceiling, Math.max(0.02, baseline + delta * 0.85));
}
