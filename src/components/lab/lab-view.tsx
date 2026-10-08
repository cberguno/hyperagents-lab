import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw, StepForward } from "lucide-react";
import { toast } from "sonner";
import { ArchiveGraph } from "@/components/lab/archive-graph";
import { DomainPicker } from "@/components/lab/domain-picker";
import { EquityChart } from "@/components/lab/equity-chart";
import { GenerationLog } from "@/components/lab/generation-log";
import { ScoreChart } from "@/components/lab/score-chart";
import { SetupSheet } from "@/components/lab/setup-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { DOMAINS, DOMAIN_BY_ID, type DomainId } from "@/lib/hyperagents/domains";
import { bestNode, formatLift, formatPct, formatScore, type RunState } from "@/lib/hyperagents/evolve";
import { proposePatch } from "@/lib/hyperagents/meta";
import { universeInfo } from "@/lib/markets/engine";
import { useLab } from "@/lib/hyperagents/store";

export function LabView() {
  const domainId = useLab((s) => s.domainId);
  const setDomain = useLab((s) => s.setDomain);
  const maxGeneration = useLab((s) => s.maxGeneration);
  const setMaxGeneration = useLab((s) => s.setMaxGeneration);
  const grokMode = useLab((s) => s.grokMode);
  const run = useLab((s) => s.run);
  const start = useLab((s) => s.start);
  const stop = useLab((s) => s.stop);
  const reset = useLab((s) => s.reset);
  const step = useLab((s) => s.step);
  const [selectedId, setSelectedId] = useState<number | null>(0);
  const [busy, setBusy] = useState(false);

  const domain = DOMAIN_BY_ID[domainId];
  const best = bestNode(run.archive);
  const selected =
    run.archive.find((n) => n.id === selectedId) ?? run.archive[run.archive.length - 1];

  useEffect(() => {
    setSelectedId(run.archive[run.archive.length - 1]?.id ?? 0);
  }, [run.archive]);

  useEffect(() => {
    if (!run.running || run.finished || busy) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (cancelled) return;
      await advance(grokMode, domainId, useLab.getState().run, step, setBusy);
    }, grokMode ? 250 : 900);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [run.running, run.finished, run.currentGen, grokMode, domainId, busy, step]);

  const onDomain = (id: DomainId) => {
    stop();
    setDomain(id);
    setSelectedId(0);
  };

  const lift = best.score - run.archive[0].score;
  const markets = domainId === "stock_trading";
  const info = universeInfo();
  const bestM = best.metrics;

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/90 px-4 py-3 backdrop-blur-sm sm:px-6">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[11px] tracking-[0.18em] text-faint uppercase">
              Meta FAIR
            </p>
            <h1 className="font-serif text-xl tracking-tight sm:text-2xl">HyperAgents Lab</h1>
          </div>
          <SetupSheet />
        </div>
      </header>

      <main className="mx-auto grid max-w-[1400px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <p className="mb-3 font-serif text-lg">Domain</p>
          <ScrollArea className="h-[calc(100dvh-8.5rem)] pr-2">
            <DomainPicker value={domainId} onChange={onDomain} />
          </ScrollArea>
        </aside>

        <section className="flex min-w-0 flex-col gap-6">
          <div className="lg:hidden">
            <p className="mb-2 text-xs font-medium tracking-wide text-faint uppercase">Domain</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {DOMAINS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onDomain(d.id)}
                  className={
                    d.id === domainId
                      ? "h-11 shrink-0 rounded-full bg-accent px-4 text-sm text-accent-fg"
                      : "h-11 shrink-0 rounded-full bg-raised px-4 text-sm text-muted"
                  }
                >
                  {d.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-serif text-3xl tracking-tight text-balance">{domain.name}</h2>
              <Badge>{domain.group}</Badge>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted text-pretty">
              {domain.description}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge>{domain.scoreKey}</Badge>
              <Badge>{domain.model}</Badge>
              {markets ? (
                <Badge>
                  {info.names} names · {info.oos}–{info.end}
                </Badge>
              ) : null}
              <Badge variant={grokMode ? "accent" : "default"}>
                {grokMode ? "Grok meta-agent" : "Catalog meta-agent"}
              </Badge>
            </div>
          </div>

          {markets ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label="Generation" value={`${run.currentGen} / ${run.maxGeneration}`} />
              <Stat
                label="Best Sharpe"
                value={formatScore(domainId, best.score)}
                hint={best.patchTitle}
                tone={best.score >= 0 ? "ok" : "warn"}
              />
              <Stat
                label="CAGR"
                value={bestM ? formatPct(bestM.cagr) : "—"}
                tone={bestM && bestM.cagr >= 0 ? "ok" : "warn"}
              />
              <Stat
                label="Max drawdown"
                value={bestM ? formatPct(bestM.maxDd) : "—"}
                hint={`Lift ${formatLift(domainId, lift)} Sharpe vs baseline`}
              />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Generation" value={`${run.currentGen} / ${run.maxGeneration}`} />
              <Stat
                label={`Best ${domain.scoreKey}`}
                value={formatPct(best.score)}
                hint={best.patchTitle}
              />
              <Stat
                label="Lift from baseline"
                value={`${lift >= 0 ? "+" : ""}${formatPct(lift)}`}
                tone={lift >= 0 ? "ok" : "warn"}
              />
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-wrap gap-2">
              {run.running ? (
                <Button onClick={stop} variant="secondary">
                  <Pause />
                  Pause
                </Button>
              ) : (
                <Button onClick={start} disabled={run.finished}>
                  <Play />
                  {run.currentGen === 0 ? "Run loop" : "Resume"}
                </Button>
              )}
              <Button
                variant="outline"
                disabled={run.running || run.finished || busy}
                onClick={() => void advance(grokMode, domainId, run, step, setBusy)}
              >
                <StepForward />
                Step
              </Button>
              <Button variant="ghost" onClick={reset}>
                <RotateCcw />
                Reset
              </Button>
            </div>
            <label className="flex min-h-11 flex-1 items-center gap-3 text-sm text-muted">
              <span className="shrink-0">Max gen</span>
              <input
                type="range"
                min={3}
                max={12}
                value={maxGeneration}
                disabled={run.running || run.currentGen > 0}
                onChange={(e) => setMaxGeneration(Number(e.target.value))}
                className="w-full accent-[var(--color-accent)]"
              />
              <span className="w-6 font-mono tabular-nums text-fg">{maxGeneration}</span>
            </label>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <p className="mb-2 text-xs font-medium tracking-wide text-faint uppercase">
                Archive
              </p>
              <ArchiveGraph
                archive={run.archive}
                selectedId={selected?.id ?? null}
                onSelect={setSelectedId}
              />
            </Card>
            <Card>
              <p className="mb-2 text-xs font-medium tracking-wide text-faint uppercase">Score</p>
              <ScoreChart archive={run.archive} scoreKey={domain.scoreKey} />
            </Card>
          </div>

          {markets ? (
            <Card>
              <p className="mb-2 text-xs font-medium tracking-wide text-faint uppercase">
                Equity · selected node vs SPY
              </p>
              <EquityChart equity={selected?.equity} />
            </Card>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <p className="mb-2 text-xs font-medium tracking-wide text-faint uppercase">
                Selected node
              </p>
              {selected ? (
                <div>
                  <p className="font-serif text-xl tracking-tight">{selected.patchTitle}</p>
                  <p className="mt-1 font-mono text-xs text-muted">
                    gen_{selected.gen}
                    {selected.parentId !== null ? ` ← gen_${selected.parentId}` : " · root"}
                    {" · "}
                    {domain.scoreKey} {selected.score.toFixed(3)}
                    {selected.metrics
                      ? ` · cagr ${(selected.metrics.cagr * 100).toFixed(1)}% · dd ${(selected.metrics.maxDd * 100).toFixed(1)}% · to ${selected.metrics.turnover.toFixed(1)}×`
                      : ""}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-muted text-pretty">
                    {selected.patchSummary}
                  </p>
                  <pre className="mt-4 overflow-x-auto rounded-lg bg-raised p-3 font-mono text-[11px] leading-relaxed text-fg">
                    {selected.diff}
                  </pre>
                </div>
              ) : null}
            </Card>
            <Card>
              <p className="mb-2 text-xs font-medium tracking-wide text-faint uppercase">
                Loop log
              </p>
              <GenerationLog logs={run.logs} />
            </Card>
          </div>

          <Separator />
          <p className="max-w-3xl text-xs leading-relaxed text-faint text-pretty">
            {markets
              ? "Each generation patches the parent agent, then this lab runs a causal close-to-close backtest on 30 liquid US names. Signals use data through yesterday; trades earn tomorrow’s return after 5 bp costs and 2% short borrow. 2016–2018 is warmup. 2019–2026 is the score. Some patches lose — that is the archive doing its job."
              : "HyperAgents keeps an evolutionary archive of task agents. A meta-agent reads the codebase and prior scores, writes a patch, and evaluates it. This lab runs that loop in the browser. Isolated Docker eval from the original generate_loop entry point is not available on this host."}
          </p>
        </section>
      </main>
    </div>
  );
}

function Stat({
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
    <Card>
      <p className="text-xs font-medium tracking-wide text-faint uppercase">{label}</p>
      <p
        className={
          tone === "ok"
            ? "mt-2 font-mono text-2xl tabular-nums text-ok"
            : tone === "warn"
              ? "mt-2 font-mono text-2xl tabular-nums text-warn"
              : "mt-2 font-mono text-2xl tabular-nums text-fg"
        }
      >
        {value}
      </p>
      {hint ? <p className="mt-1 truncate text-xs text-muted">{hint}</p> : null}
    </Card>
  );
}

async function advance(
  grokMode: boolean,
  domainId: DomainId,
  run: RunState,
  step: ReturnType<typeof useLab.getState>["step"],
  setBusy: (v: boolean) => void,
) {
  setBusy(true);
  try {
    if (grokMode) {
      const parent = run.archive[run.archive.length - 1];
      const result = await proposePatch({
        data: {
          domainId,
          parentScore: parent.score,
          parentPatch: parent.patchTitle,
          history: run.archive.map((n) => ({
            gen: n.gen,
            title: n.patchTitle,
            score: n.score,
          })),
        },
      });
      if (result.ok) step(result.patch);
      else {
        toast(result.error);
        step();
      }
    } else {
      step();
    }
  } catch {
    toast("Meta-agent call failed; using the local patch catalog.");
    step();
  } finally {
    setBusy(false);
  }
}
