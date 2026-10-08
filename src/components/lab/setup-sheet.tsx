import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useLab, loadStoredKeys } from "@/lib/hyperagents/store";
import { Check, Minus, Settings2 } from "lucide-react";

function StatusRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-raised px-3 py-3">
      <span className={ok ? "text-ok" : "text-faint"}>
        {ok ? <Check className="size-4" /> : <Minus className="size-4" />}
      </span>
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs leading-relaxed text-muted text-pretty">{detail}</p>
      </div>
    </div>
  );
}

export function SetupSheet() {
  const keys = useLab((s) => s.keys);
  const setKeys = useLab((s) => s.setKeys);
  const grokMode = useLab((s) => s.grokMode);
  const setGrokMode = useLab((s) => s.setGrokMode);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const stored = loadStoredKeys();
    if (stored) setKeys(stored);
  }, [setKeys]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="size-4" />
          Setup
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Lab setup</SheetTitle>
          <SheetDescription>
            Keys stay in this browser. The in-browser replica does not need them.
            Turn on Grok as meta-agent to spend a small amount of the host quota per generation.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3">
          <StatusRow
            ok
            label="Stock trading harness"
            detail="30 US names, Yahoo daily bars 2016–2026. Close-to-close walk-forward from 2019, 5 bp costs, weekly rebalance. Each generation is a real backtest."
          />
          <StatusRow
            ok={false}
            label="Isolated eval containers"
            detail="Docker is not available on this host. generate_loop.py cannot spawn eval containers here. The lab runs the same archive algorithm in the browser."
          />
          <StatusRow
            ok={Boolean(keys.openai || keys.anthropic || keys.gemini)}
            label="Provider keys"
            detail="Optional. Used only if you later run the original harness against OpenAI, Anthropic, or Gemini."
          />
        </div>
        <div className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="openai">OPENAI_API_KEY</Label>
            <Input
              id="openai"
              type="password"
              autoComplete="off"
              value={keys.openai}
              onChange={(e) => setKeys({ openai: e.target.value })}
              placeholder="sk-…"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="anthropic">ANTHROPIC_API_KEY</Label>
            <Input
              id="anthropic"
              type="password"
              autoComplete="off"
              value={keys.anthropic}
              onChange={(e) => setKeys({ anthropic: e.target.value })}
              placeholder="sk-ant-…"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gemini">GEMINI_API_KEY</Label>
            <Input
              id="gemini"
              type="password"
              autoComplete="off"
              value={keys.gemini}
              onChange={(e) => setKeys({ gemini: e.target.value })}
              placeholder="AIza…"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setGrokMode(!grokMode)}
          className="mt-6 flex min-h-11 w-full items-center justify-between rounded-lg bg-raised px-3 py-3 text-left"
        >
          <span>
            <span className="block text-sm font-medium">Grok as meta-agent</span>
            <span className="block text-xs text-muted">
              One user-initiated call per generation
            </span>
          </span>
          <span
            className={
              grokMode
                ? "rounded-full bg-accent px-2.5 py-0.5 text-xs text-accent-fg"
                : "rounded-full bg-bg px-2.5 py-0.5 text-xs text-muted"
            }
          >
            {grokMode ? "On" : "Off"}
          </span>
        </button>
      </SheetContent>
    </Sheet>
  );
}
