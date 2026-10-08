/** Pure presentation helpers. No React, no simulation imports. null is always shown as "—", never 0. */
import type { ConnectionState, ControlRepeat, Generation, LineageNode } from "./types.ts";

export const CONTROL_LABEL = "FIXED-CODE EVALUATION RELIABILITY CONTROL";
export const EM = "—";

export function fmtScore(n: number | null | undefined, digits = 2): string {
  return n === null || n === undefined ? EM : n.toFixed(digits);
}

export function fmtPct(n: number | null | undefined, digits = 0): string {
  return n === null || n === undefined ? EM : `${(n * 100).toFixed(digits)}%`;
}

export function fmtInt(n: number | null | undefined): string {
  return n === null || n === undefined ? EM : String(n);
}

export function fmtMoney(n: number | null | undefined): string {
  return n === null || n === undefined ? EM : `$${n.toFixed(3)}`;
}

export function fmtDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return EM;
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
}

export function fmtGiB(bytes: number | null | undefined): string {
  return bytes === null || bytes === undefined ? EM : `${(bytes / 2 ** 30).toFixed(1)} GiB`;
}

export function connectionLabel(state: ConnectionState): string {
  switch (state) {
    case "live":
      return "LIVE";
    case "stale":
      return "STALE";
    case "fixture":
      return "DEVELOPMENT FIXTURE";
    case "unavailable":
      return "TELEMETRY UNAVAILABLE";
  }
}

/** Generation ids are labelled as generations; repeats get their own label and are never mixed. */
export function generationLabel(id: string): string {
  return id === "initial" ? "initial" : `Gen ${id}`;
}

export function repeatLabel(n: number): string {
  return `Repeat ${n}`;
}

export type RepeatRow = {
  title: string;
  partial: boolean;
  statusLabel: string;
  note: string | null;
  train: string;
  validation: string;
  chart: { label: string; train: number | null; validation: number | null };
};

export function presentRepeat(r: ControlRepeat): RepeatRow {
  const partial = r.status === "partial";
  return {
    title: repeatLabel(r.repeat),
    partial,
    statusLabel: partial ? "PARTIAL" : r.status.toUpperCase(),
    note: partial
      ? r.reason
        ? `Validation ${r.reason.replace(/^validation\s+/i, "")}`
        : "Validation unavailable"
      : null,
    train: fmtScore(r.train_score),
    // null stays null: a censored validation is never rendered as a number
    validation: fmtScore(r.validation_score),
    chart: { label: `R${r.repeat}`, train: r.train_score, validation: r.validation_score },
  };
}

export function scoreSummary(n: LineageNode | Generation): string {
  if (n.validation_score !== null) return `val ${fmtScore(n.validation_score)}`;
  if (n.staged_validation !== null) return `staged ${fmtScore(n.staged_validation)} · no full eval`;
  return "no eval recorded";
}

/** Depth of each node from the root, from parent links only. Nodes whose parent is missing get depth 0. */
export function depthOf(nodes: LineageNode[]): Map<string, number> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const memo = new Map<string, number>();
  const visit = (id: string, seen: Set<string>): number => {
    const known = memo.get(id);
    if (known !== undefined) return known;
    const n = byId.get(id);
    if (!n || n.parent_id === null || !byId.has(n.parent_id) || seen.has(id)) {
      memo.set(id, 0);
      return 0;
    }
    seen.add(id);
    const d = visit(n.parent_id, seen) + 1;
    memo.set(id, d);
    return d;
  };
  for (const n of nodes) visit(n.id, new Set());
  return memo;
}
