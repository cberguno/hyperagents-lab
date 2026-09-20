export type MutationId =
  | "volTarget"
  | "costHurdle"
  | "regimeFilter"
  | "drawdownBreaker"
  | "crossSectional"
  | "walkForward";

export type Mutation = {
  id: MutationId;
  value?: number;
};

export type Patch = {
  title: string;
  summary: string;
  diff: string;
  delta: number;
  mutation?: Mutation;
};

export type Domain = {
  id: string;
  name: string;
  group: string;
  scoreKey: string;
  model: string;
  description: string;
  baseline: number;
  ceiling: number;
  patches: Patch[];
};

export type BookConfig = {
  volTarget: number | null;
  costHurdle: boolean;
  regimeFilter: boolean;
  drawdownBreaker: boolean;
  crossSectional: boolean;
  walkForward: boolean;
};

export type Metrics = {
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

export type EquityPoint = { d: string; v: number; spy: number };

export type BacktestResult = {
  sharpe: number;
  metrics: Metrics;
  equity: EquityPoint[];
  config: BookConfig;
};

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
  config?: BookConfig;
  metrics?: Metrics;
  equity?: EquityPoint[];
};

export type LogKind = "system" | "eval" | "select" | "meta" | "keep";

export type LoopLog = {
  id: string;
  gen: number;
  kind: LogKind;
  text: string;
};

export type LoopState = {
  domainId: string;
  maxGeneration: number;
  seed: number;
  rng: number;
  usedPatches: number[];
  archive: ArchiveNode[];
  logs: LoopLog[];
  currentGen: number;
  running: boolean;
  finished: boolean;
  grokMode: boolean;
};
