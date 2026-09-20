import { create } from "zustand";

type Keys = { openai?: string; anthropic?: string; gemini?: string };

type LabStore = {
  grokMode: boolean;
  keys: Keys;
  setGrokMode: (v: boolean) => void;
  setKeys: (keys: Keys) => void;
};

export const useLabStore = create<LabStore>((set) => ({
  grokMode: false,
  keys: {},
  setGrokMode: (grokMode) => set({ grokMode }),
  setKeys: (keys) => set({ keys }),
}));
