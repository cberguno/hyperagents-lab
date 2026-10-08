import { bestNode, type ArchiveNode } from "@/lib/hyperagents/evolve";
import { cn } from "@/lib/utils";

type Props = {
  archive: ArchiveNode[];
  selectedId: number | null;
  onSelect: (id: number) => void;
};

export function ArchiveGraph({ archive, selectedId, onSelect }: Props) {
  const best = archive.length ? bestNode(archive) : null;
  const maxGen = Math.max(0, ...archive.map((n) => n.gen));
  const cols = maxGen + 1;
  const grouped = Array.from({ length: cols }, (_, g) =>
    archive.filter((n) => n.gen === g),
  );
  const maxStack = Math.max(1, ...grouped.map((g) => g.length));
  const cellW = 72;
  const cellH = 56;
  const width = Math.max(320, cols * cellW + 24);
  const height = Math.max(140, maxStack * cellH + 28);
  const pos = new Map<number, { x: number; y: number }>();
  grouped.forEach((nodes, g) => {
    nodes.forEach((n, i) => {
      pos.set(n.id, {
        x: 28 + g * cellW,
        y: 24 + i * cellH + ((maxStack - nodes.length) * cellH) / 2,
      });
    });
  });

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[180px] w-full min-w-[320px] sm:h-[220px]"
        role="img"
        aria-label="Evolutionary archive"
      >
        {archive.map((n) => {
          if (n.parentId === null) return null;
          const a = pos.get(n.parentId);
          const b = pos.get(n.id);
          if (!a || !b) return null;
          return (
            <line
              key={`e-${n.id}`}
              x1={a.x + 10}
              y1={a.y}
              x2={b.x - 10}
              y2={b.y}
              className="stroke-border"
              strokeWidth={1}
            />
          );
        })}
        {archive.map((n) => {
          const p = pos.get(n.id);
          if (!p) return null;
          const isBest = best?.id === n.id;
          const isSel = selectedId === n.id;
          return (
            <g
              key={n.id}
              transform={`translate(${p.x},${p.y})`}
              className="cursor-pointer"
              onClick={() => onSelect(n.id)}
            >
              <circle
                r={11}
                className={cn(
                  isSel
                    ? "fill-accent stroke-accent"
                    : isBest
                      ? "fill-ok/30 stroke-ok"
                      : "fill-raised stroke-border",
                )}
                strokeWidth={1.5}
              />
              <text
                textAnchor="middle"
                dy="0.35em"
                className={cn(
                  "fill-fg text-[9px] font-mono",
                  isSel && "fill-accent-fg",
                )}
              >
                {n.gen}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
