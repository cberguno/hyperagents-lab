export type StrategyConfig = {
  volTarget: number | null;
  costHurdle: boolean;
  regimeFilter: boolean;
  drawdownBreaker: boolean;
  crossSectional: boolean;
  walkForward: boolean;
};

export const BASELINE_CONFIG: StrategyConfig = {
  volTarget: null,
  costHurdle: false,
  regimeFilter: false,
  drawdownBreaker: false,
  crossSectional: false,
  walkForward: false,
};

export type StockMutation =
  | { id: "volTarget"; value: number }
  | { id: "costHurdle" }
  | { id: "regimeFilter" }
  | { id: "drawdownBreaker" }
  | { id: "crossSectional" }
  | { id: "walkForward" };

export type TradeMetrics = {
  sharpe: number;
  deflatedSharpe: number;
  cagr: number;
  maxDd: number;
  turnover: number;
  hitRate: number;
  nDays: number;
  start: string;
  end: string;
};

export type EquityPt = { d: string; v: number; spy: number };

export type EvalResult = {
  sharpe: number;
  metrics: TradeMetrics;
  equity: EquityPt[];
  config: StrategyConfig;
};

export function applyMutation(cfg: StrategyConfig, mutation?: StockMutation): StrategyConfig {
  if (!mutation) return { ...cfg };
  const next = { ...cfg };
  switch (mutation.id) {
    case "volTarget":
      next.volTarget = mutation.value;
      break;
    case "costHurdle":
      next.costHurdle = true;
      break;
    case "regimeFilter":
      next.regimeFilter = true;
      break;
    case "drawdownBreaker":
      next.drawdownBreaker = true;
      break;
    case "crossSectional":
      next.crossSectional = true;
      break;
    case "walkForward":
      next.walkForward = true;
      break;
  }
  return next;
}

export function mutationApplied(cfg: StrategyConfig, mutation?: StockMutation): boolean {
  if (!mutation) return false;
  switch (mutation.id) {
    case "volTarget":
      return cfg.volTarget !== null;
    case "costHurdle":
      return cfg.costHurdle;
    case "regimeFilter":
      return cfg.regimeFilter;
    case "drawdownBreaker":
      return cfg.drawdownBreaker;
    case "crossSectional":
      return cfg.crossSectional;
    case "walkForward":
      return cfg.walkForward;
  }
}

export function configKey(cfg: StrategyConfig): string {
  return [
    cfg.volTarget ?? "eq",
    cfg.costHurdle ? 1 : 0,
    cfg.regimeFilter ? 1 : 0,
    cfg.drawdownBreaker ? 1 : 0,
    cfg.crossSectional ? 1 : 0,
    cfg.walkForward ? 1 : 0,
  ].join("|");
}

export function trialCount(cfg: StrategyConfig): number {
  return (
    1 +
    (cfg.volTarget !== null ? 1 : 0) +
    Number(cfg.costHurdle) +
    Number(cfg.regimeFilter) +
    Number(cfg.drawdownBreaker) +
    Number(cfg.crossSectional) +
    Number(cfg.walkForward)
  );
}
