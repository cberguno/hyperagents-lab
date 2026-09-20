import catalog from "@/data/domains.json";
import type { Domain } from "./types";

export const DOMAINS = catalog as Domain[];
export const DOMAIN_BY_ID = Object.fromEntries(DOMAINS.map((d) => [d.id, d]));
export const DOMAIN_GROUPS = [
  "Markets",
  "Science",
  "Retrieval",
  "BALROG",
  "Genesis",
  "Math",
  "Code",
] as const;

export function isStockTrading(id: string) {
  return id === "stock_trading";
}

export function isTrading(id: string) {
  return id === "trading";
}

export function isTransferPair(id: string) {
  return id === "trading" || id === "paper_review";
}
