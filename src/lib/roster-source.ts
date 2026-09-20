export type RosterGeneration = {
  gen: string;
  timestamp: string | null;
  balance: number | null;
  reward: number | null;
  selfModCount: number;
  taskInstruction: string;
  metaInstruction: string;
  taskChanged: boolean;
  metaChanged: boolean;
  previousTaskInstruction: string | null;
  previousMetaInstruction: string | null;
  diff: string;
};

export type RosterPosition = {
  symbol: string;
  qty: number;
  side: string;
  avgPrice: number;
  currentPrice: number;
  unrealizedPl: number;
  marketValue: number;
};

export type RosterFill = {
  id: string;
  symbol: string;
  side: string;
  qty: number;
  price: number;
  timestamp: string;
  realizedPl: number | null;
  unrealizedPl: number | null;
  kind: "fill" | "hold";
};

export type RosterBalance = {
  equity: number;
  cash: number;
  startingEquity: number;
  pnl: number;
};

export type RosterSnapshot = {
  domainId: "stock_trading";
  source: string | null;
  runId: string | null;
  hint: string | null;
  generations: RosterGeneration[];
  balance: RosterBalance | null;
  positions: RosterPosition[];
  fills: RosterFill[];
};

export const EMPTY_ROSTER_SNAPSHOT: RosterSnapshot = {
  domainId: "stock_trading",
  source: null,
  runId: null,
  hint: "No HyperAgents archive.jsonl found. Set HYPERAGENTS_OUTPUTS or keep the lineage under work/hyperagents/outputs.",
  generations: [],
  balance: null,
  positions: [],
  fills: [],
};

export async function fetchRosterSnapshot(): Promise<RosterSnapshot> {
  const res = await fetch("/api/roster", { method: "GET" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text.slice(0, 200) || `Roster archive HTTP ${res.status}`);
  }
  return (await res.json()) as RosterSnapshot;
}
