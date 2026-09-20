import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="rounded-lg bg-raised px-4 py-3 shadow-[var(--shadow-border)]">
      <p className="text-[11px] font-medium tracking-wide text-faint uppercase">{label}</p>
      <p
        className={cn(
          "mt-1 font-mono text-xl tabular-nums",
          tone === "ok" ? "text-fg" : tone === "warn" ? "text-muted" : "text-fg",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 truncate text-xs text-faint">{hint}</p> : null}
    </div>
  );
}
