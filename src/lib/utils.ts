import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPct(n: number, digits = 1) {
  return `${(n * 100).toFixed(digits)}%`;
}

export function formatScore(domainId: string, n: number) {
  return domainId === "stock_trading" ? n.toFixed(2) : formatPct(n);
}

export function formatLift(domainId: string, n: number) {
  const sign = n >= 0 ? "+" : "";
  return domainId === "stock_trading" ? `${sign}${n.toFixed(2)}` : `${sign}${formatPct(n)}`;
}
