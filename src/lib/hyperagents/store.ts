import { create } from "zustand";
import { type DomainId, type Patch } from "./domains";
import { createRun, stepOnce, type LogEntry, type RunState, type StepResult } from "./evolve";

export type Keys = {
  openai: string;
  anthropic: string;
  gemini: string;
};

type LabStore = {
  domainId: DomainId;
  maxGeneration: number;
  grokMode: boolean;
  keys: Keys;
  run: RunState;
  lastStep: StepResult | null;
  setDomain: (id: DomainId) => void;
  setMaxGeneration: (n: number) => void;
  setGrokMode: (v: boolean) => void;
  setKeys: (keys: Partial<Keys>) => void;
  reset: () => void;
  start: () => void;
  stop: () => void;
  step: (overridePatch?: Patch) => StepResult | null;
};

const defaultDomain: DomainId = "stock_trading";

function fresh(
  domainId: DomainId,
  maxGeneration: number,
  grokMode: boolean,
  seed?: number,
): RunState {
  return createRun(domainId, maxGeneration, grokMode, seed ?? 0xc0ffee);
}

export const useLab = create<LabStore>((set, get) => ({
  domainId: defaultDomain,
  maxGeneration: 8,
  grokMode: false,
  keys: { openai: "", anthropic: "", gemini: "" },
  run: fresh(defaultDomain, 8, false),
  lastStep: null,
  setDomain: (id) => {
    const { maxGeneration, grokMode } = get();
    set({
      domainId: id,
      lastStep: null,
      run: fresh(id, maxGeneration, grokMode),
    });
  },
  setMaxGeneration: (n) => {
    const maxGeneration = Math.min(12, Math.max(3, n));
    set((s) => ({
      maxGeneration,
      run: s.run.currentGen === 0 ? { ...s.run, maxGeneration } : s.run,
    }));
  },
  setGrokMode: (v) => set({ grokMode: v }),
  setKeys: (keys) => {
    const next = { ...get().keys, ...keys };
    set({ keys: next });
    if (typeof window !== "undefined") {
      window.localStorage.setItem("hyperagents-keys", JSON.stringify(next));
    }
  },
  reset: () => {
    const { domainId, maxGeneration, grokMode } = get();
    set({ lastStep: null, run: fresh(domainId, maxGeneration, grokMode, Date.now() >>> 0) });
  },
  start: () =>
    set((s) => ({
      run: {
        ...s.run,
        running: !s.run.finished,
        grokMode: s.grokMode,
        maxGeneration: s.maxGeneration,
      },
    })),
  stop: () => set((s) => ({ run: { ...s.run, running: false } })),
  step: (overridePatch) => {
    const run = structuredClone(get().run) as RunState;
    const result = stepOnce(run, overridePatch);
    if (!result) {
      set({ run: { ...run, running: false, finished: true } });
      return null;
    }
    set({ run, lastStep: result });
    return result;
  },
}));

export function loadStoredKeys(): Keys | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("hyperagents-keys");
    if (!raw) return null;
    return JSON.parse(raw) as Keys;
  } catch {
    return null;
  }
}

export function latestLogs(logs: LogEntry[], n = 40) {
  return logs.slice(-n);
}
