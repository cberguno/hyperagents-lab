import { useLive } from "@/lib/live/client";
import { ControlPanelView } from "./control-panel";
import { ConnectionBadge, LoadingPanel, UnavailablePanel } from "./live-primitives";

export function ControlSection() {
  const control = useLive("control");
  if (control.loading && !control.data) return <LoadingPanel />;
  if (!control.data)
    return <UnavailablePanel reason={control.reason} what="The reliability control" />;
  return (
    <div className="flex flex-col gap-3">
      <ConnectionBadge state={control.state} fetchedAt={control.fetchedAt} />
      <ControlPanelView control={control.data} />
    </div>
  );
}
