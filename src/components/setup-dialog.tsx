import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLabStore } from "@/lib/store";

const KEYS_KEY = "hyperagents-lab.keys";

type Keys = { openai?: string; anthropic?: string; gemini?: string };

function loadKeys(): Keys {
  try {
    return JSON.parse(localStorage.getItem(KEYS_KEY) ?? "{}") as Keys;
  } catch {
    return {};
  }
}

export function SetupDialog() {
  const grokMode = useLabStore((s) => s.grokMode);
  const setGrokMode = useLabStore((s) => s.setGrokMode);
  const setKeys = useLabStore((s) => s.setKeys);
  const [open, setOpen] = useState(false);
  const [keys, setLocalKeys] = useState<Keys>({});

  useEffect(() => {
    const stored = loadKeys();
    setLocalKeys(stored);
    setKeys(stored);
  }, [setKeys]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="size-4" />
          Setup
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(520px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-raised p-5 shadow-[var(--shadow-border)]">
          <Dialog.Title className="font-serif text-xl">Lab setup</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-relaxed text-muted">
            Keys stay in this browser. The in-browser replica does not need them. Turn on Grok as
            meta-agent to spend a small amount of the host quota per generation.
          </Dialog.Description>
          <div className="mt-4 flex flex-col gap-3 text-sm">
            <Row ok label="Stock trading harness" detail="30 US names, Yahoo daily bars 2016–2026. Close-to-close walk-forward from 2019, 5 bp costs, weekly rebalance. Each generation is a real backtest." />
            <Row ok label="Trading harness" detail="Frozen n=100 snapshots (10 names × 10 dates). Task agent JSON {action,size,reasoning}. Score is mean P&L minus buy-and-hold. No live API, no broker. Dual-scored with paper review each generation." />
            <Row ok={false} label="Paper / BALROG / Genesis / IMO / polyglot" detail="Scored from the catalog of published patches with noise. Full Docker eval is not in this browser build. Paper review also reports the frozen trading transfer score without changing its catalog RNG." />
            <label className="mt-2 flex items-center justify-between gap-3 rounded-md bg-bg px-3 py-3">
              <span>
                <span className="block font-medium">Grok meta-agent</span>
                <span className="block text-xs text-faint">Ask the host model to pick the next patch</span>
              </span>
              <input
                type="checkbox"
                checked={grokMode}
                onChange={(e) => setGrokMode(e.target.checked)}
              />
            </label>
            <label className="block text-xs text-faint">
              OpenAI
              <input
                className="mt-1 h-10 w-full rounded-md bg-bg px-3 font-mono text-fg shadow-[var(--shadow-border)]"
                value={keys.openai ?? ""}
                onChange={(e) => {
                  const next = { ...keys, openai: e.target.value };
                  setLocalKeys(next);
                  localStorage.setItem(KEYS_KEY, JSON.stringify(next));
                  setKeys(next);
                }}
                placeholder="sk-…"
              />
            </label>
          </div>
          <div className="mt-5 flex justify-end">
            <Button size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Row({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="rounded-md bg-bg px-3 py-3">
      <p className="font-medium">
        <span className="mr-2 font-mono text-[11px] text-faint">{ok ? "ready" : "catalog"}</span>
        {label}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{detail}</p>
    </div>
  );
}
