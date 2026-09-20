import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, StepForward } from "lucide-react";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import { DomainNav } from "@/components/domain-nav";
import { EquityChart } from "@/components/equity-chart";
import { SetupDialog } from "@/components/setup-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/stat-card";
import { DOMAIN_BY_ID, DOMAINS, isStockTrading } from "@/lib/domains";
import { champion, openArchive, stepGeneration } from "@/lib/loop";
import { marketMeta } from "@/lib/backtest";
import { useLabStore } from "@/lib/store";
import type { ArchiveNode, LoopState, Patch } from "@/lib/types";
import { cn, formatLift, formatPct, formatScore } from "@/lib/utils";

function cloneState(s: LoopState): LoopState {
  return {
    ...s,
    usedPatches: [...s.usedPatches],
    archive: s.archive.map((n) => ({ ...n })),
    logs: s.logs.map((l) => ({ ...l })),
  };
}

export function Lab() {
  const grokMode = useLabStore((s) => s.grokMode);
  const [domainId, setDomainId] = useState("stock_trading");
  const [maxGen, setMaxGen] = useState(8);
  const [state, setState] = useState<LoopState>(() => openArchive("stock_trading", 8, false));
  const [selectedId, setSelectedId] = useState(0);
  const [busy, setBusy] = useState(false);
  const timer = useRef<number | null>(null);
  const domain = DOMAIN_BY_ID[domainId]!;
  const market = marketMeta();

  useEffect(() => {
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, []);

  function reset(nextId = domainId, gen = maxGen, grok = grokMode) {
    if (timer.current) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
    const next = openArchive(nextId, gen, grok);
    setState(next);
    setSelectedId(0);
  }

  function onDomain(id: string) {
    setDomainId(id);
    reset(id, maxGen, grokMode);
  }

  function applyStep(forced?: Patch) {
    setState((prev) => {
      const next = cloneState(prev);
      next.grokMode = grokMode;
      const result = stepGeneration(next, forced);
      if (result) setSelectedId(result.node.id);
      return { ...next };
    });
  }

  function runLoop() {
    if (state.finished) return;
    setState((s) => ({ ...s, running: true }));
    timer.current = window.setInterval(() => {
      setState((prev) => {
        if (prev.finished || prev.currentGen >= prev.maxGeneration) {
          if (timer.current) window.clearInterval(timer.current);
          timer.current = null;
          return { ...prev, running: false, finished: true };
        }
        const next = cloneState(prev);
        next.running = true;
        const result = stepGeneration(next);
        if (result) setSelectedId(result.node.id);
        if (next.finished && timer.current) {
          window.clearInterval(timer.current);
          timer.current = null;
        }
        return { ...next };
      });
    }, 650);
  }

  function pause() {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    setState((s) => ({ ...s, running: false }));
  }

  async function stepOnce() {
    if (grokMode) {
      setBusy(true);
      try {
        const parent = state.archive[state.archive.length - 1]!;
        const res = await fetch("/api/meta-agent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            domainId,
            parentScore: parent.score,
            parentPatch: parent.patchTitle,
            history: state.archive.map((n) => ({ gen: n.gen, title: n.patchTitle, score: n.score })),
          }),
        });
        const body = (await res.json()) as { ok: boolean; patch?: Patch };
        applyStep(body.ok ? body.patch : undefined);
      } catch {
        applyStep();
      } finally {
        setBusy(false);
      }
      return;
    }
    applyStep();
  }

  const best = champion(state.archive);
  const selected = state.archive.find((n) => n.id === selectedId) ?? best;
  const lift = best.score - (state.archive[0]?.score ?? 0);
  const metrics = selected.metrics;
  const trading = isStockTrading(domainId);

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/90 px-4 py-3 backdrop-blur-sm sm:px-6">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[11px] tracking-[0.18em] text-faint uppercase">Meta FAIR</p>
            <h1 className="font-serif text-xl tracking-tight sm:text-2xl">HyperAgents Lab</h1>
          </div>
          <SetupDialog />
        </div>
      </header>
      <main className="mx-auto grid max-w-[1400px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <p className="mb-3 font-serif text-lg">Domain</p>
          <ScrollArea.Root className="h-[calc(100dvh-8.5rem)] pr-2">
            <ScrollArea.Viewport className="h-full">
              <DomainNav value={domainId} onChange={onDomain} />
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar orientation="vertical" className="w-2">
              <ScrollArea.Thumb className="rounded-full bg-border" />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>
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
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted text-pretty">{domain.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge>{domain.scoreKey}</Badge>
              <Badge>{domain.model}</Badge>
              {trading ? (
                <Badge>
                  {market.names} names · {market.oos}–{market.end}
                </Badge>
              ) : null}
              <Badge variant={grokMode ? "accent" : "default"}>
                {grokMode ? "Grok meta-agent" : "Catalog meta-agent"}
              </Badge>
            </div>
          </div>
          {trading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Generation" value={`${state.currentGen} / ${state.maxGeneration}`} />
              <StatCard
                label="Best Sharpe"
                value={formatScore(domainId, best.score)}
                hint={best.patchTitle}
                tone={best.score >= 0 ? "ok" : "warn"}
              />
              <StatCard
                label="CAGR"
                value={metrics ? formatPct(metrics.cagr) : "—"}
                tone={metrics && metrics.cagr >= 0 ? "ok" : "warn"}
              />
              <StatCard
                label="Max drawdown"
                value={metrics ? formatPct(metrics.maxDd) : "—"}
                hint={`Lift ${formatLift(domainId, lift)} Sharpe vs baseline`}
              />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Generation" value={`${state.currentGen} / ${state.maxGeneration}`} />
              <StatCard label={`Best ${domain.scoreKey}`} value={formatPct(best.score)} hint={best.patchTitle} />
              <StatCard
                label="Lift from baseline"
                value={`${lift >= 0 ? "+" : ""}${formatPct(lift)}`}
                tone={lift >= 0 ? "ok" : "warn"}
              />
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-wrap gap-2">
              {state.running ? (
                <Button onClick={pause} variant="secondary">
                  <Pause className="mr-2 size-4" />
                  Pause
                </Button>
              ) : (
                <Button onClick={runLoop} disabled={state.finished}>
                  <Play className="mr-2 size-4" />
                  {state.currentGen === 0 ? "Run loop" : "Resume"}
                </Button>
              )}
              <Button
                variant="outline"
                disabled={state.running || state.finished || busy}
                onClick={() => void stepOnce()}
              >
                <StepForward className="mr-2 size-4" />
                Step
              </Button>
              <Button variant="ghost" onClick={() => reset()}>
                <RotateCcw className="mr-2 size-4" />
                Reset
              </Button>
            </div>
            <label className="flex min-h-11 flex-1 items-center gap-3 text-sm text-muted">
              <span className="shrink-0">Max gen</span>
              <input
                type="range"
                min={3}
                max={12}
                value={maxGen}
                disabled={state.running || state.currentGen > 0}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setMaxGen(v);
                  setState((s) => ({ ...s, maxGeneration: v }));
                }}
                className="w-full"
              />
              <span className="w-6 font-mono tabular-nums text-fg">{maxGen}</span>
            </label>
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <Panel title="Archive">
              <ArchiveList archive={state.archive} selectedId={selected.id} onSelect={setSelectedId} />
            </Panel>
            <Panel title={trading ? "Equity · selected node vs SPY" : "Score"}>
              {trading && selected.equity?.length ? (
                <EquityChart points={selected.equity} />
              ) : (
                <ScoreBars archive={state.archive} selectedId={selected.id} />
              )}
            </Panel>
          </div>
          <Panel title="Selected node">
            <p className="font-medium">{selected.patchTitle}</p>
            <p className="mt-1 font-mono text-xs text-faint">
              gen_{selected.gen} · {selected.parentId == null ? "root" : `child of ${selected.parentId}`} ·{" "}
              {domain.scoreKey} {selected.score.toFixed(3)}
              {selected.metrics
                ? ` · cagr ${(selected.metrics.cagr * 100).toFixed(1)}% · dd ${(selected.metrics.maxDd * 100).toFixed(1)}% · to ${selected.metrics.turnover.toFixed(1)}×`
                : null}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted">{selected.patchSummary}</p>
            <pre className="mt-4 overflow-x-auto rounded-md bg-bg p-4 font-mono text-[12px] leading-relaxed text-muted">
              {selected.diff}
            </pre>
          </Panel>
          <Panel title="Loop log">
            <ol className="space-y-1.5 font-mono text-[12px] text-muted">
              {state.logs.map((l, i) => (
                <li key={l.id}>
                  <span className="text-faint">{i + 1}.</span>{" "}
                  <span className="text-faint">g{l.gen}</span> {l.kind} {l.text}
                </li>
              ))}
            </ol>
          </Panel>
          {trading ? (
            <p className="text-sm leading-relaxed text-muted">
              Each generation patches the parent agent, then this lab runs a causal close-to-close backtest on 30
              liquid US names. Signals use data through yesterday; trades earn tomorrow’s return after 5 bp costs
              and 2% short borrow. 2016–2018 is warmup. 2019–2026 is the score. Some patches lose — that is the
              archive doing its job.
            </p>
          ) : (
            <p className="text-sm leading-relaxed text-muted">
              Catalog domains score published patches with noise. They are not a substitute for the Docker
              HyperAgents harness.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg bg-raised p-4 shadow-[var(--shadow-border)] sm:p-5">
      <h3 className="mb-3 font-serif text-lg">{title}</h3>
      {children}
    </section>
  );
}

function ArchiveList({
  archive,
  selectedId,
  onSelect,
}: {
  archive: ArchiveNode[];
  selectedId: number;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {archive.map((n) => (
        <button
          key={n.id}
          type="button"
          onClick={() => onSelect(n.id)}
          className={cn(
            "flex items-baseline justify-between gap-3 rounded-md px-3 py-2 text-left",
            n.id === selectedId ? "bg-accent text-accent-fg" : "hover:bg-bg",
          )}
        >
          <span className="min-w-0 truncate text-sm">
            <span className="font-mono text-[11px] opacity-70">gen_{n.gen}</span> {n.patchTitle}
          </span>
          <span className="shrink-0 font-mono text-xs tabular-nums">{n.score.toFixed(3)}</span>
        </button>
      ))}
    </div>
  );
}

function ScoreBars({ archive, selectedId }: { archive: ArchiveNode[]; selectedId: number }) {
  const max = Math.max(...archive.map((n) => n.score), 0.01);
  return (
    <div className="flex h-56 items-end gap-1">
      {archive.map((n) => (
        <div
          key={n.id}
          className={cn("flex-1 rounded-sm", n.id === selectedId ? "bg-accent" : "bg-border")}
          style={{ height: `${Math.max(8, (n.score / max) * 100)}%` }}
          title={`${n.patchTitle} ${n.score.toFixed(3)}`}
        />
      ))}
    </div>
  );
}
