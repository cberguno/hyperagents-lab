import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { connectionLabel } from "@/lib/live/present";
import type { ConnectionState } from "@/lib/live/types";
import { cn } from "@/lib/utils";

const VARIANT: Record<ConnectionState, "ok" | "warn" | "default" | "accent"> = {
  live: "ok",
  stale: "warn",
  fixture: "accent",
  unavailable: "warn",
};

export function ConnectionBadge({
  state,
  fetchedAt,
}: {
  state: ConnectionState;
  fetchedAt?: string | null;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <Badge variant={VARIANT[state]} data-connection={state}>
        {connectionLabel(state)}
      </Badge>
      {fetchedAt ? (
        <span className="font-mono text-[11px] text-faint">
          {new Date(fetchedAt).toLocaleTimeString()}
        </span>
      ) : null}
    </span>
  );
}

export function UnavailablePanel({ reason, what }: { reason?: string | null; what?: string }) {
  return (
    <Card role="status" data-unavailable="true">
      <p className="font-mono text-sm tracking-wide text-warn">TELEMETRY UNAVAILABLE</p>
      <p className="mt-2 text-sm text-muted text-pretty">
        {what ? `${what} cannot be shown. ` : ""}
        Live data could not be read from the telemetry service. Nothing is simulated or substituted.
        {reason ? ` (${reason.replace(/_/g, " ")})` : ""}
      </p>
    </Card>
  );
}

export function LoadingPanel() {
  return (
    <Card>
      <p className="font-mono text-sm text-faint">Reading telemetry…</p>
    </Card>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-xs font-medium tracking-wide text-faint uppercase">{children}</p>;
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "ok" | "warn";
}) {
  return (
    <Card>
      <p className="text-xs font-medium tracking-wide text-faint uppercase">{label}</p>
      <p
        className={cn(
          "mt-2 font-mono text-2xl tabular-nums",
          tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : "text-fg",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 truncate text-xs text-muted">{hint}</p> : null}
    </Card>
  );
}

export function KV({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-1.5 last:border-0">
      <dt className="text-xs text-faint">{label}</dt>
      <dd className="min-w-0 truncate text-right font-mono text-xs text-fg">{value}</dd>
    </div>
  );
}
