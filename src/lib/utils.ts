import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPct(n: number, digits = 1) {
  return `${(n * 100).toFixed(digits)}%`;
}

export function formatScore(domainId: string, n: number) {
  if (domainId === "stock_trading") return n.toFixed(2);
  if (domainId === "trading") return formatPct(n, 2);
  return formatPct(n);
}

export function formatLift(domainId: string, n: number) {
  const sign = n >= 0 ? "+" : "";
  if (domainId === "stock_trading") return `${sign}${n.toFixed(2)}`;
  if (domainId === "trading") return `${sign}${formatPct(n, 2)}`;
  return `${sign}${formatPct(n)}`;
}
