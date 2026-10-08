import { useEffect, useState } from "react";
import { LabView } from "@/components/lab/lab-view";
import { LiveView } from "@/components/live/live-view";
import { cn } from "@/lib/utils";

type Mode = "lab" | "live";

const MODES: { id: Mode; label: string; hint: string }[] = [
  {
    id: "lab",
    label: "LAB / SIMULATION",
    hint: "in-browser loop · stock backtest · synthetic scores",
  },
  { id: "live", label: "LIVE HYPERAGENTS", hint: "read-only telemetry of the real experiment" },
];

/**
 * Top-level separation of the two worlds. The mode is local UI state only: it is deliberately not
 * kept in the Lab store, so Live never shares state, scoring or the meta-agent with the simulation.
 */
export function ModeShell() {
  const [mode, setMode] = useState<Mode>("lab");

  useEffect(() => {
    if (window.location.hash === "#live") setMode("live");
  }, []);

  const choose = (m: Mode) => {
    setMode(m);
    window.history.replaceState(
      null,
      "",
      m === "live" ? "#live" : window.location.pathname + window.location.search,
    );
  };

  return (
    <>
      <nav aria-label="Mode" className="border-b border-border bg-surface px-4 py-2 sm:px-6">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-2">
          <div role="tablist" className="flex gap-1 rounded-full bg-raised p-1">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={mode === m.id}
                data-mode={m.id}
                onClick={() => choose(m.id)}
                className={cn(
                  "h-9 rounded-full px-4 font-mono text-[11px] tracking-[0.12em]",
                  mode === m.id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <span className="hidden text-xs text-faint sm:inline">
            {MODES.find((m) => m.id === mode)?.hint}
          </span>
        </div>
      </nav>
      {mode === "lab" ? <LabView /> : <LiveView />}
    </>
  );
}
