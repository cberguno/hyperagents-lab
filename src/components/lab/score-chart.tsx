import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ArchiveNode } from "@/lib/hyperagents/evolve";

type Props = {
  archive: ArchiveNode[];
  scoreKey: string;
};

export function ScoreChart({ archive, scoreKey }: Props) {
  const data = archive.map((n) => ({
    gen: n.gen,
    score: Number(n.score.toFixed(4)),
    best: Number(n.bestSoFar.toFixed(4)),
  }));

  return (
    <div className="h-[180px] w-full sm:h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="gen"
            tick={{ fill: "var(--color-faint)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={["auto", "auto"]}
            tick={{ fill: "var(--color-faint)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
            tickFormatter={(v: number) => v.toFixed(2)}
          />
          <RTooltip
            contentStyle={{
              background: "var(--color-raised)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--color-fg)",
            }}
            formatter={(value, name) => [
              Number(value).toFixed(3),
              name === "best" ? "best so far" : scoreKey,
            ]}
            labelFormatter={(l) => `gen_${l}`}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="var(--color-muted)"
            strokeWidth={1.5}
            dot={{ r: 3, fill: "var(--color-muted)" }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="best"
            stroke="var(--color-accent)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
