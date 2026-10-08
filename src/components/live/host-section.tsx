import { useLive } from "@/lib/live/client";
import { HostPanelView } from "./host-panel";
import { ConnectionBadge, LoadingPanel, UnavailablePanel } from "./live-primitives";

export function HostSection() {
  const host = useLive("host");
  const docker = useLive("docker");
  if ((host.loading && !host.data) || (docker.loading && !docker.data)) return <LoadingPanel />;
  if (!host.data && !docker.data)
    return <UnavailablePanel reason={host.reason} what="Host and Docker state" />;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3">
        <ConnectionBadge state={host.state} fetchedAt={host.fetchedAt} />
      </div>
      <HostPanelView host={host.data} docker={docker.data} />
    </div>
  );
}
