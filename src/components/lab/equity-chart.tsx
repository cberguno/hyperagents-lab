import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EquityPt } from "@/lib/markets/types";

type Props = {
  equity?: EquityPt[];
};

export function EquityChart({ equity }: Props) {
  const data = (equity ?? []).map((p) => ({
    d: p.d.slice(2),
    book: Number((p.v - 1) * 100),
    spy: Number((p.spy - 1) * 100),
  }));

  if (!data.length) {
    return (
      <p className="py-10 text-center text-sm text-muted">
        Run the loop to backtest this node.
      </p>
    );
  }

  return (
    <div className="h-[180px] w-full sm:h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="d"
            tick={{ fill: "var(--color-faint)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={48}
          />
          <YAxis
            tick={{ fill: "var(--color-faint)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
            tickFormatter={(v: number) => `${v.toFixed(0)}%`}
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
              `${Number(value).toFixed(1)}%`,
              name === "spy" ? "SPY buy & hold" : "task agent",
            ]}
            labelFormatter={(l) => l}
          />
          <Line
            type="monotone"
            dataKey="spy"
            stroke="var(--color-faint)"
            strokeWidth={1.25}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="book"
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
