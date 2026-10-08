import { Card } from "@/components/ui/card";
import { depthOf, generationLabel, scoreSummary } from "@/lib/live/present";
import type { Lineage } from "@/lib/live/types";
import { cn } from "@/lib/utils";
import { SectionTitle } from "./live-primitives";

type Props = {
  lineage: Lineage;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const COL_W = 132;
const ROW_H = 74;
const NODE_W = 108;
const NODE_H = 52;

/** Real archive ancestry. Independent of the simulation ArchiveGraph; failed nodes stay visible. */
export function LiveLineage({ lineage, selectedId, onSelect }: Props) {
  const depth = depthOf(lineage.nodes);
  const columns = new Map<number, string[]>();
  for (const n of lineage.nodes) {
    const d = depth.get(n.id) ?? 0;
    columns.set(d, [...(columns.get(d) ?? []), n.id]);
  }
  const maxDepth = Math.max(0, ...columns.keys());
  const maxStack = Math.max(1, ...[...columns.values()].map((c) => c.length));
  const pos = new Map<string, { x: number; y: number }>();
  for (const [d, ids] of columns) {
    ids.forEach((id, i) => {
      pos.set(id, { x: 12 + d * COL_W, y: 12 + i * ROW_H + ((maxStack - ids.length) * ROW_H) / 2 });
    });
  }
  const width = 24 + (maxDepth + 1) * COL_W;
  const height = 24 + maxStack * ROW_H;
  const evolvedBest = new Set(lineage.best_evolved_validation.ids);

  return (
    <Card>
      <SectionTitle>Epoch H lineage · real archive</SectionTitle>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ minWidth: width }}
          className="h-[240px] w-full"
          role="img"
          aria-label="Epoch H generation lineage"
        >
          {lineage.edges.map((e) => {
            const a = pos.get(e.from);
            const b = pos.get(e.to);
            if (!a || !b) return null;
            return (
              <line
                key={`${e.from}-${e.to}`}
                x1={a.x + NODE_W}
                y1={a.y + NODE_H / 2}
                x2={b.x}
                y2={b.y + NODE_H / 2}
                className="stroke-border"
                strokeWidth={1.5}
              />
            );
          })}
          {lineage.nodes.map((n) => {
            const p = pos.get(n.id);
            if (!p) return null;
            const selected = selectedId === n.id;
            const failed = n.validation_score === null && n.staged_validation === 0;
            const isChampion = lineage.champion === n.id;
            const isEvolvedBest = evolvedBest.has(n.id);
            return (
              <g
                key={n.id}
                transform={`translate(${p.x},${p.y})`}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                aria-label={`${generationLabel(n.id)} ${scoreSummary(n)}`}
                aria-pressed={selected}
                data-node={n.id}
                data-failed={failed ? "true" : "false"}
                onClick={() => onSelect(n.id)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    onSelect(n.id);
                  }
                }}
              >
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx={10}
                  className={cn(
                    selected
                      ? "fill-accent stroke-accent"
                      : failed
                        ? "fill-raised stroke-warn"
                        : isEvolvedBest || isChampion
                          ? "fill-ok/20 stroke-ok"
                          : "fill-raised stroke-border",
                  )}
                  strokeWidth={1.5}
                />
                <text
                  x={10}
                  y={20}
                  className={cn("font-mono text-[12px]", selected ? "fill-accent-fg" : "fill-fg")}
                >
                  {generationLabel(n.id)}
                </text>
                <text
                  x={10}
                  y={38}
                  className={cn(
                    "font-mono text-[10px]",
                    selected ? "fill-accent-fg" : "fill-muted",
                  )}
                >
                  {n.validation_score !== null
                    ? `val ${n.validation_score.toFixed(2)}`
                    : n.staged_validation !== null
                      ? `staged ${n.staged_validation.toFixed(2)}`
                      : "no eval"}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <li>
          <span className="mr-1.5 inline-block size-2 rounded-sm border border-ok bg-ok/20" />
          best validation: {lineage.champion ? generationLabel(lineage.champion) : "—"}
          {lineage.best_validation_ties ? ` (tie: ${lineage.best_validation_ties.join(", ")})` : ""}
        </li>
        <li>
          best evolved: {lineage.best_evolved_validation.score?.toFixed(2) ?? "—"} ·{" "}
          {lineage.best_evolved_validation.ids.map(generationLabel).join(", ") || "—"}
        </li>
        <li>
          <span className="mr-1.5 inline-block size-2 rounded-sm border border-warn" />
          failed staged evaluation (kept in the archive)
        </li>
      </ul>
    </Card>
  );
}
