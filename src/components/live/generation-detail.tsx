import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  fmtDuration,
  fmtInt,
  fmtMoney,
  fmtPct,
  fmtScore,
  generationLabel,
  EM,
} from "@/lib/live/present";
import type { GenerationDetail as Detail, SplitEval } from "@/lib/live/types";
import { KV, SectionTitle } from "./live-primitives";

function Split({ title, ev }: { title: string; ev: SplitEval | null }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted">{title}</p>
      {ev ? (
        <dl>
          <KV label={`${ev.kind} accuracy (${ev.rows ?? EM} rows)`} value={fmtScore(ev.accuracy)} />
          <KV label="accept recall" value={fmtScore(ev.accept_recall)} />
          <KV label="reject recall" value={fmtScore(ev.reject_recall)} />
          <KV label="None predictions" value={fmtInt(ev.none_count)} />
        </dl>
      ) : (
        <p className="text-xs text-faint">{EM} no evaluation recorded</p>
      )}
    </div>
  );
}

/** Pure presentation of one real generation. Every null renders as an em dash, never a number. */
export function GenerationDetailView({ g }: { g: Detail }) {
  const calls = g.detail.task_calls;
  return (
    <Card>
      <SectionTitle>Generation detail</SectionTitle>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-serif text-2xl tracking-tight">{generationLabel(g.id)}</h3>
        <Badge>{g.parent_id === null ? "root" : `parent ${generationLabel(g.parent_id)}`}</Badge>
        <Badge variant={g.valid_parent === null ? "default" : g.valid_parent ? "ok" : "warn"}>
          valid_parent {g.valid_parent === null ? EM : String(g.valid_parent)}
        </Badge>
      </div>
      <p className="mt-2 text-sm text-muted text-pretty">
        {g.mutation_summary ?? "No mutation summary recorded."}
      </p>

      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <dl>
          <KV
            label="staged train / validation"
            value={`${fmtScore(g.staged_train)} / ${fmtScore(g.staged_validation)}`}
          />
          <KV
            label="full train / validation"
            value={`${fmtScore(g.train_score)} / ${fmtScore(g.validation_score)}`}
          />
          <KV
            label="children"
            value={g.children.length ? g.children.map(generationLabel).join(", ") : EM}
          />
          <KV label="files changed" value={g.files_changed?.join(", ") ?? EM} />
          <KV label="started" value={g.timestamp ? new Date(g.timestamp).toLocaleString() : EM} />
          <KV label="duration" value={fmtDuration(g.duration_seconds)} />
        </dl>
        <dl>
          <KV label="meta model" value={g.meta_model ?? EM} />
          <KV label="task model" value={g.task_model ?? EM} />
          <KV label="task provider" value={g.provider ?? EM} />
          <KV
            label="cost task / meta / total"
            value={`${fmtMoney(g.cost.task)} / ${fmtMoney(g.cost.meta)} / ${fmtMoney(g.cost.total)}`}
          />
          <KV label="staged scores from" value={g.detail.staged_source ?? EM} />
        </dl>
      </div>

      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <Split title="Full evaluation · train" ev={g.detail.train_eval} />
        <Split title="Full evaluation · validation" ev={g.detail.validation_eval} />
      </div>

      <div className="mt-4">
        <p className="mb-1 text-xs font-medium text-muted">
          Task-model calls (pooled over this generation)
        </p>
        {calls ? (
          <dl>
            <KV label="unique requests" value={calls.n_unique_requests} />
            <KV
              label="finish reasons"
              value={Object.entries(calls.finish_reasons)
                .map(([k, v]) => `${k} ${v}`)
                .join(" · ")}
            />
            <KV
              label="abnormal (length/error)"
              value={`${calls.abnormal_length_or_error} (${fmtPct(calls.abnormal_length_or_error / Math.max(1, calls.n_unique_requests), 1)})`}
            />
          </dl>
        ) : (
          <p className="text-xs text-faint">{EM} no task-call log for this generation</p>
        )}
        {g.detail.unavailable.length ? (
          <p className="mt-2 text-xs text-faint text-pretty">
            Unavailable: {g.detail.unavailable.join("; ")}.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
