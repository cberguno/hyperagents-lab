import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EM, fmtDuration, fmtGiB } from "@/lib/live/present";
import type { DockerInfo, HostInfo } from "@/lib/live/types";
import { KV, SectionTitle } from "./live-primitives";

export function HostPanelView({
  host,
  docker,
}: {
  host: HostInfo | null;
  docker: DockerInfo | null;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2" data-section="host">
      <Card>
        <SectionTitle>Host · read-only</SectionTitle>
        {host ? (
          <dl>
            <KV
              label="disk free"
              value={`${fmtGiB(host.disk.free_bytes)} of ${fmtGiB(host.disk.total_bytes)} (${host.disk.used_percent}% used)`}
            />
            <KV
              label="memory available (est.)"
              value={`${fmtGiB(host.memory.available_estimate_bytes)} of ${fmtGiB(host.memory.total_bytes)}`}
            />
            <KV
              label="swap used"
              value={`${(host.swap.used_mb / 1024).toFixed(1)} of ${(host.swap.total_mb / 1024).toFixed(1)} GiB`}
            />
            <KV
              label="load 1 / 5 / 15 min"
              value={`${host.load_average["1m"]} / ${host.load_average["5m"]} / ${host.load_average["15m"]}`}
            />
            <KV label="uptime" value={fmtDuration(host.uptime_seconds)} />
            <KV
              label="disk trend"
              value={`${host.disk.trend.samples} sample(s) since the service started`}
            />
          </dl>
        ) : (
          <p className="text-sm text-faint">{EM}</p>
        )}
      </Card>
      <Card>
        <SectionTitle>Docker · read-only</SectionTitle>
        {docker ? (
          <>
            <div className="mb-2 flex gap-2">
              <Badge variant={docker.reachable ? "ok" : "warn"}>
                {docker.reachable ? "reachable" : "not reachable"}
              </Badge>
              {docker.server_version ? <Badge>engine {docker.server_version}</Badge> : null}
            </div>
            <dl>
              <KV label="image" value={docker.image?.name ?? EM} />
              <KV
                label="image id"
                value={
                  docker.image?.id ? docker.image.id.replace("sha256:", "").slice(0, 16) + "…" : EM
                }
              />
              <KV
                label="running containers"
                value={docker.running_containers === null ? EM : docker.running_containers.length}
              />
            </dl>
            {docker.running_containers?.map((c) => (
              <p key={c.id ?? c.name} className="mt-1 font-mono text-xs text-muted">
                {c.name} · {c.status}
              </p>
            ))}
          </>
        ) : (
          <p className="text-sm text-faint">{EM}</p>
        )}
      </Card>
    </div>
  );
}
