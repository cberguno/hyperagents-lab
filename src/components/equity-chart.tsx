import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { EquityPoint } from "@/lib/types";

export function EquityChart({ points }: { points: EquityPoint[] }) {
  const data = points.map((p) => ({
    d: p.d.slice(2),
    lab: ((p.v - 1) * 100).toFixed(1),
    spy: ((p.spy - 1) * 100).toFixed(1),
    v: (p.v - 1) * 100,
    s: (p.spy - 1) * 100,
  }));
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="d" hide />
          <YAxis hide domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={{
              background: "#1a1a1f",
              border: "1px solid #2a2a30",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#8e8e96" }}
            formatter={(value, name) => [
              `${Number(value).toFixed(1)}%`,
              name === "v" ? "agent" : "SPY",
            ]}
          />
          <Line type="monotone" dataKey="s" stroke="#6a6a72" dot={false} strokeWidth={1.25} />
          <Line type="monotone" dataKey="v" stroke="#ececef" dot={false} strokeWidth={1.75} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
