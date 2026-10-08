import { useState } from "react";
import { useLive } from "@/lib/live/client";
import { GenerationDetailView } from "./generation-detail";
import { LiveLineage } from "./live-lineage";
import { ConnectionBadge, LoadingPanel, UnavailablePanel } from "./live-primitives";

function DetailLoader({ id }: { id: string }) {
  const g = useLive("generation", id);
  if (g.loading && !g.data) return <LoadingPanel />;
  if (!g.data) return <UnavailablePanel reason={g.reason} what={`Generation ${id}`} />;
  return <GenerationDetailView g={g.data} />;
}

export function EvolutionPanel() {
  const lineage = useLive("lineage");
  const epoch = useLive("epochH");
  const [selected, setSelected] = useState<string | null>(null);
  if (lineage.loading && !lineage.data) return <LoadingPanel />;
  if (!lineage.data) return <UnavailablePanel reason={lineage.reason} what="The lineage" />;
  const sel =
    selected ??
    (epoch.data ? String(epoch.data.latest_generation) : (lineage.data.nodes.at(-1)?.id ?? null));
  return (
    <div className="flex flex-col gap-4" data-section="evolution">
      <div className="flex items-center gap-2">
        <ConnectionBadge state={lineage.state} fetchedAt={lineage.fetchedAt} />
        <p className="text-xs text-faint">
          Archive ancestry as recorded. Select a generation for detail.
        </p>
      </div>
      <LiveLineage lineage={lineage.data} selectedId={sel} onSelect={setSelected} />
      {sel ? <DetailLoader id={sel} /> : null}
    </div>
  );
}
