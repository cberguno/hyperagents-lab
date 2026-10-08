import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useLive } from "@/lib/live/client";
import { EM, fmtGiB, fmtScore, generationLabel } from "@/lib/live/present";
import { ConnectionBadge, KV, SectionTitle, Stat, UnavailablePanel } from "./live-primitives";

/** Overview: every number comes from the telemetry API; "—" means unavailable. */
export function OverviewPanel() {
  const status = useLive("status");
  const epoch = useLive("epochH");
  const gens = useLive("generations");
  const lineage = useLive("lineage");
  const integrity = useLive("integrity");
  const host = useLive("host");
  const docker = useLive("docker");

  if (status.state === "unavailable" && epoch.state === "unavailable") {
    return <UnavailablePanel reason={status.reason} what="The overview" />;
  }

  const latestId = epoch.data ? String(epoch.data.latest_generation) : null;
  const latest = gens.data?.generations.find((g) => g.id === latestId) ?? null;
  const nodes = lineage.data?.nodes ?? [];
  const best = lineage.data?.champion ? nodes.find((n) => n.id === lineage.data?.champion) : null;
  const bestEvolved = lineage.data?.best_evolved_validation ?? null;
  const diskOk = host.data ? host.data.disk.free_gib >= 15 : undefined;

  return (
    <div className="flex flex-col gap-4" data-section="overview">
      <div className="flex flex-wrap items-center gap-2">
        <ConnectionBadge state={status.state} fetchedAt={status.fetchedAt} />
        {epoch.data ? (
          <Badge variant="accent">
            Epoch {epoch.data.epoch} · {epoch.data.status ?? EM}
          </Badge>
        ) : null}
        <Badge>read-only</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Latest generation"
          value={latestId ?? EM}
          hint={
            epoch.data
              ? `${epoch.data.generation_count} archive nodes · no later generation exists`
              : undefined
          }
        />
        <Stat
          label="Best validation"
          value={fmtScore(best?.validation_score)}
          hint={best ? `${generationLabel(best.id)} · raw full-eval validation` : undefined}
        />
        <Stat
          label="Best evolved validation"
          value={fmtScore(bestEvolved?.score)}
          hint={
            bestEvolved?.ids.length ? bestEvolved.ids.map(generationLabel).join(", ") : undefined
          }
        />
        <Stat
          label="Archive integrity"
          value={integrity.data?.overall ?? EM}
          tone={integrity.data ? (integrity.data.overall === "ok" ? "ok" : "warn") : undefined}
          hint={
            integrity.data
              ? `control checksums ${integrity.data.control_root.ok}/${integrity.data.control_root.total}`
              : undefined
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle>Models · latest generation</SectionTitle>
          <dl>
            <KV label="meta model" value={latest?.meta_model ?? EM} />
            <KV label="task model" value={latest?.task_model ?? EM} />
            <KV label="task provider" value={latest?.provider ?? EM} />
            <KV
              label="archive sha256"
              value={epoch.data ? epoch.data.archive.sha256.slice(0, 16) + "…" : EM}
            />
          </dl>
        </Card>
        <Card>
          <SectionTitle>Reliability control</SectionTitle>
          <dl>
            <KV label="status" value={status.data?.control.status ?? EM} />
            {status.data
              ? Object.entries(status.data.control.repeats).map(([k, v]) => (
                  <KV key={k} label={`Repeat ${k}`} value={v.toUpperCase()} />
                ))
              : null}
          </dl>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Disk free"
          value={host.data ? fmtGiB(host.data.disk.free_bytes) : EM}
          tone={diskOk === undefined ? undefined : diskOk ? "ok" : "warn"}
          hint={host.data ? `${host.data.disk.used_percent}% used` : undefined}
        />
        <Stat
          label="RAM available"
          value={host.data ? fmtGiB(host.data.memory.available_estimate_bytes) : EM}
          hint={host.data ? `of ${fmtGiB(host.data.memory.total_bytes)}` : undefined}
        />
        <Stat
          label="Swap used"
          value={host.data ? `${(host.data.swap.used_mb / 1024).toFixed(1)} GiB` : EM}
          hint={host.data ? `of ${(host.data.swap.total_mb / 1024).toFixed(1)} GiB` : undefined}
        />
        <Stat
          label="Docker"
          value={docker.data ? (docker.data.reachable ? "reachable" : "down") : EM}
          tone={docker.data ? (docker.data.reachable ? "ok" : "warn") : undefined}
          hint={
            docker.data?.running_containers
              ? `${docker.data.running_containers.length} running container(s)`
              : undefined
          }
        />
      </div>
    </div>
  );
}
