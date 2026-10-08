import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  CONTROL_LABEL,
  EM,
  fmtDuration,
  fmtInt,
  fmtMoney,
  fmtPct,
  fmtScore,
  presentRepeat,
} from "@/lib/live/present";
import type { ControlOverview, ControlRepeat } from "@/lib/live/types";
import { cn } from "@/lib/utils";
import { SectionTitle, Stat } from "./live-primitives";

function ValidationCell({ r }: { r: ControlRepeat }) {
  const p = presentRepeat(r);
  return <span className={cn(p.partial && "text-warn")}>{p.validation}</span>;
}

/** Repeats of one fixed condition. Never labelled as generations. Repeat 3's censored validation is a gap, not a point. */
export function ControlPanelView({ control }: { control: ControlOverview }) {
  const s = control.summary;
  const rows = control.repeats.map(presentRepeat);
  const partial = control.repeats.filter((r) => r.status === "partial");
  return (
    <div className="flex flex-col gap-4" data-section="reliability-control">
      <div>
        <h2 className="font-serif text-2xl tracking-tight">{CONTROL_LABEL}</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted text-pretty">
          Five repeats of one frozen task condition, used to measure evaluation noise. These are
          repeats, not generations: nothing evolves between them.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant="accent">{s.status ?? EM}</Badge>
          <Badge>{s.train.completed_sets ?? EM} train sets</Badge>
          <Badge>{s.validation.completed_sets ?? EM} completed validation sets</Badge>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Train accuracy"
          value={fmtScore(s.train.mean_accuracy, 3)}
          hint={`sd ${fmtScore(s.train.sample_sd, 4)} · range ${s.train.range_text ?? EM}`}
        />
        <Stat
          label="Validation accuracy"
          value={fmtScore(s.validation.mean_accuracy, 3)}
          hint={`sd ${fmtScore(s.validation.sample_sd, 4)} · range ${s.validation.range_text ?? EM}`}
        />
        <Stat
          label="Complete runs"
          value={`${fmtInt(s.provider.complete_runs)} / ${fmtInt(s.provider.total_runs)}`}
          hint={s.provider.partial_runs ? `${s.provider.partial_runs} partial` : "no partial runs"}
          tone={s.provider.partial_runs ? "warn" : "ok"}
        />
        <Stat
          label="Provider calls ok"
          value={`${fmtInt(s.provider.successful_provider_calls)} / ${fmtInt(s.provider.total_provider_calls)}`}
        />
      </div>

      {partial.map((r) => (
        <Card key={r.repeat} role="note" data-partial={r.repeat}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="warn">PARTIAL</Badge>
            <span className="font-mono text-sm">Repeat {r.repeat}</span>
          </div>
          <p className="mt-2 text-sm text-muted text-pretty">
            Validation {r.reason?.replace(/^validation\s+/i, "") ?? "unavailable"}. Train is valid (
            {fmtScore(r.train_score)}). The validation score is unavailable, not zero, and is not
            estimated.
          </p>
        </Card>
      ))}

      <Card>
        <SectionTitle>Accuracy by repeat</SectionTitle>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={rows.map((r) => r.chart)}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--color-faint)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0.5, 0.7]}
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
                  value === null || value === undefined ? EM : Number(value).toFixed(2),
                  name,
                ]}
              />
              <Line
                type="monotone"
                dataKey="train"
                name="train"
                stroke="var(--color-muted)"
                strokeWidth={1.5}
                dot={{ r: 3 }}
                isAnimationActive={false}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="validation"
                name="validation"
                stroke="var(--color-accent)"
                strokeWidth={2}
                dot={{ r: 3 }}
                isAnimationActive={false}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-1 text-xs text-faint">
          Gaps are intentional: a censored validation is not plotted.
        </p>
      </Card>

      <Card className="overflow-x-auto">
        <SectionTitle>Repeats</SectionTitle>
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead className="text-faint">
            <tr>
              {[
                "Repeat",
                "Status",
                "Train",
                "Validation",
                "Accept/Reject recall",
                "None (tr/val)",
                "Retries",
                "Failed calls",
                "Cost",
                "Duration",
                "Checksums",
              ].map((h) => (
                <th key={h} className="py-1.5 pr-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="font-mono">
            {control.repeats.map((r, i) => {
              const p = rows[i];
              return (
                <tr
                  key={r.repeat}
                  className={cn("border-t border-border/60", p.partial && "bg-warn/5")}
                  data-repeat={r.repeat}
                >
                  <td className="py-1.5 pr-3">{p.title}</td>
                  <td className="pr-3">
                    <Badge variant={p.partial ? "warn" : "ok"}>{p.statusLabel}</Badge>
                  </td>
                  <td className="pr-3">{p.train}</td>
                  <td className="pr-3">
                    <ValidationCell r={r} />
                  </td>
                  <td className="pr-3">
                    {fmtScore(r.accept_recall.train)}/{fmtScore(r.reject_recall.train)}
                    {r.accept_recall.validation === null
                      ? ""
                      : ` · ${fmtScore(r.accept_recall.validation)}/${fmtScore(r.reject_recall.validation)}`}
                  </td>
                  <td className="pr-3">
                    {fmtInt(r.none_count.train)}/{fmtInt(r.none_count.validation)}
                  </td>
                  <td className="pr-3">
                    {r.retries.retry_events} ({r.retries.unrecovered_requests} unrecovered)
                  </td>
                  <td className="pr-3">
                    {r.provider_failures.failed_calls}/{r.provider_failures.total_calls}
                  </td>
                  <td className="pr-3">{fmtMoney(r.cost.total)}</td>
                  <td className="pr-3">{fmtDuration(r.duration_seconds)}</td>
                  <td>
                    {r.integrity.state === "verified"
                      ? `${r.integrity.ok}/${r.integrity.total} ok`
                      : r.integrity.state}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-faint">
          Abnormal-output rate (train):{" "}
          {control.repeats.map((r) => fmtPct(r.abnormal_output_rate.train)).join(" · ")}
        </p>
      </Card>

      {s.serving_conclusion ? (
        <Card>
          <SectionTitle>Serving-condition conclusion (from the frozen summary)</SectionTitle>
          <p className="text-sm text-muted text-pretty">{s.serving_conclusion}</p>
        </Card>
      ) : null}
    </div>
  );
}
