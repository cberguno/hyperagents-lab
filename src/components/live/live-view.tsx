import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { ControlSection } from "./control-section";
import { EvolutionPanel } from "./evolution-panel";
import { HostSection } from "./host-section";
import { OverviewPanel } from "./overview-panel";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "evolution", label: "Evolution" },
  { id: "control", label: "Reliability control" },
  { id: "host", label: "Host" },
] as const;
type TabId = (typeof TABS)[number]["id"];

/**
 * LIVE HYPERAGENTS: read-only observation of real telemetry. It owns its own query client and has no
 * controls: nothing here starts, stops, selects, mutates or scores anything.
 */
export function LiveView() {
  const [client] = useState(() => new QueryClient());
  const [tab, setTab] = useState<TabId>("overview");
  return (
    <QueryClientProvider client={client}>
      <div className="min-h-dvh bg-bg text-fg" data-mode-view="live">
        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
          <h1 className="font-serif text-3xl tracking-tight">Live HyperAgents</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted text-pretty">
            Read-only view of the real experiment. No simulation, no meta-agent, no controls.
          </p>
          <div
            role="tablist"
            aria-label="Live sections"
            className="mt-4 flex gap-2 overflow-x-auto pb-1"
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "h-11 shrink-0 rounded-full px-4 text-sm",
                  tab === t.id ? "bg-accent text-accent-fg" : "bg-raised text-muted hover:text-fg",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="mt-6" role="tabpanel">
            {tab === "overview" ? <OverviewPanel /> : null}
            {tab === "evolution" ? <EvolutionPanel /> : null}
            {tab === "control" ? <ControlSection /> : null}
            {tab === "host" ? <HostSection /> : null}
          </div>
        </main>
      </div>
    </QueryClientProvider>
  );
}
