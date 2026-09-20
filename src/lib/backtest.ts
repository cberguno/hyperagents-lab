import meta from "@/data/markets-meta.json";
import spy from "@/data/markets-spy.json";
import AAPL from "@/data/closes/AAPL.json";
import MSFT from "@/data/closes/MSFT.json";
import GOOGL from "@/data/closes/GOOGL.json";
import AMZN from "@/data/closes/AMZN.json";
import NVDA from "@/data/closes/NVDA.json";
import META from "@/data/closes/META.json";
import AVGO from "@/data/closes/AVGO.json";
import AMD from "@/data/closes/AMD.json";
import JPM from "@/data/closes/JPM.json";
import BAC from "@/data/closes/BAC.json";
import GS from "@/data/closes/GS.json";
import JNJ from "@/data/closes/JNJ.json";
import UNH from "@/data/closes/UNH.json";
import PFE from "@/data/closes/PFE.json";
import ABBV from "@/data/closes/ABBV.json";
import LLY from "@/data/closes/LLY.json";
import XOM from "@/data/closes/XOM.json";
import CVX from "@/data/closes/CVX.json";
import PG from "@/data/closes/PG.json";
import KO from "@/data/closes/KO.json";
import PEP from "@/data/closes/PEP.json";
import COST from "@/data/closes/COST.json";
import WMT from "@/data/closes/WMT.json";
import HD from "@/data/closes/HD.json";
import CAT from "@/data/closes/CAT.json";
import BA from "@/data/closes/BA.json";
import V from "@/data/closes/V.json";
import MA from "@/data/closes/MA.json";
import DIS from "@/data/closes/DIS.json";
import NFLX from "@/data/closes/NFLX.json";
import type { BacktestResult, BookConfig, EquityPoint, Mutation } from "./types";

const DATA = {
  dates: meta.dates as string[],
  tickers: meta.tickers as string[],
  sectors: meta.sectors as string[],
  adv: meta.adv as number[],
  close: [
    AAPL, MSFT, GOOGL, AMZN, NVDA, META, AVGO, AMD, JPM, BAC, GS, JNJ, UNH, PFE,
    ABBV, LLY, XOM, CVX, PG, KO, PEP, COST, WMT, HD, CAT, BA, V, MA, DIS, NFLX,
  ] as number[][],
  spy: spy as number[],
};
const COST_BPS = 5e-4;
const BORROW_DAILY = 0.02 / 252;
const OOS = "2019-01-02";
const SQRT252 = Math.sqrt(252);
const REBALANCE = 5;

export const EMPTY_CONFIG: BookConfig = {
  volTarget: null,
  costHurdle: false,
  regimeFilter: false,
  drawdownBreaker: false,
  crossSectional: false,
  walkForward: false,
};

export function applyMutation(cfg: BookConfig, m?: Mutation): BookConfig {
  if (!m) return { ...cfg };
  const next = { ...cfg };
  switch (m.id) {
    case "volTarget":
      next.volTarget = m.value ?? 0.1;
      break;
    case "costHurdle":
      next.costHurdle = true;
      break;
    case "regimeFilter":
      next.regimeFilter = true;
      break;
    case "drawdownBreaker":
      next.drawdownBreaker = true;
      break;
    case "crossSectional":
      next.crossSectional = true;
      break;
    case "walkForward":
      next.walkForward = true;
      break;
  }
  return next;
}

export function hasMutation(cfg: BookConfig, m?: Mutation) {
  if (!m) return false;
  switch (m.id) {
    case "volTarget":
      return cfg.volTarget !== null;
    case "costHurdle":
      return cfg.costHurdle;
    case "regimeFilter":
      return cfg.regimeFilter;
    case "drawdownBreaker":
      return cfg.drawdownBreaker;
    case "crossSectional":
      return cfg.crossSectional;
    case "walkForward":
      return cfg.walkForward;
  }
}

function configKey(cfg: BookConfig) {
  return [
    cfg.volTarget ?? "eq",
    +!!cfg.costHurdle,
    +!!cfg.regimeFilter,
    +!!cfg.drawdownBreaker,
    +!!cfg.crossSectional,
    +!!cfg.walkForward,
  ].join("|");
}

function nTrials(cfg: BookConfig) {
  return (
    1 +
    (cfg.volTarget === null ? 0 : 1) +
    Number(cfg.costHurdle) +
    Number(cfg.regimeFilter) +
    Number(cfg.drawdownBreaker) +
    Number(cfg.crossSectional) +
    Number(cfg.walkForward)
  );
}

function stdev(xs: number[], from: number, to: number) {
  const n = to - from;
  if (n < 2) return 0;
  let mean = 0;
  for (let i = from; i < to; i++) mean += xs[i]!;
  mean /= n;
  let varSum = 0;
  for (let i = from; i < to; i++) {
    const d = xs[i]! - mean;
    varSum += d * d;
  }
  return Math.sqrt(varSum / (n - 1));
}

function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function quantile(xs: number[], q: number) {
  if (!xs.length) return 0;
  const s = xs.slice().sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return lo === hi ? s[lo]! : s[lo]! * (hi - pos) + s[hi]! * (pos - lo);
}

function sign(x: number) {
  return x > 0 ? 1 : x < 0 ? -1 : 0;
}

type Engine = {
  dates: string[];
  tickers: string[];
  n: number;
  t: number;
  oos0: number;
  ret: number[][];
  spyRet: number[];
  mom21: number[][];
  mom126: number[][];
  mom12: number[][];
  vol: number[][];
  beta: number[][];
  spyMom12: number[];
  spyVol20: number[];
  spyQ80: number[];
  sectorOf: number[];
  sectors: string[];
};

let cached: Engine | null = null;

function buildEngine(): Engine {
  const dates = DATA.dates;
  const tickers = DATA.tickers;
  const n = tickers.length;
  const t = dates.length;
  const close = DATA.close;
  const spy = DATA.spy;
  const ret = Array.from({ length: n }, () => Array(t).fill(0));
  const spyRet = Array(t).fill(0);
  for (let i = 1; i < t; i++) {
    spyRet[i] = spy[i]! / spy[i - 1]! - 1;
    for (let j = 0; j < n; j++) {
      const prev = close[j]![i - 1]!;
      ret[j]![i] = prev > 0 ? close[j]![i]! / prev - 1 : 0;
    }
  }
  const mom21 = Array.from({ length: n }, () => Array(t).fill(0));
  const mom126 = Array.from({ length: n }, () => Array(t).fill(0));
  const mom12 = Array.from({ length: n }, () => Array(t).fill(0));
  const vol = Array.from({ length: n }, () => Array(t).fill(0));
  const beta = Array.from({ length: n }, () => Array(t).fill(1));
  const spyMom12 = Array(t).fill(0);
  const spyVol20 = Array(t).fill(0);
  const spyQ80 = Array(t).fill(0);
  for (let i = 1; i < t; i++) {
    if (i - 1 - 252 >= 0) spyMom12[i] = spy[i - 1 - 21]! / spy[i - 1 - 252]! - 1;
    const volFrom = Math.max(1, i - 20);
    spyVol20[i] = stdev(spyRet, volFrom, i) * SQRT252;
    const qFrom = Math.max(1, i - 252);
    const hist: number[] = [];
    for (let k = qFrom; k < i; k++) hist.push(spyVol20[k]!);
    spyQ80[i] = quantile(hist, 0.8);
    for (let j = 0; j < n; j++) {
      if (i - 1 - 21 >= 0 && close[j]![i - 1 - 21]! > 0) {
        mom21[j]![i] = close[j]![i - 1]! / close[j]![i - 1 - 21]! - 1;
      }
      if (i - 1 - 126 >= 0 && close[j]![i - 1 - 126]! > 0) {
        mom126[j]![i] = close[j]![i - 1]! / close[j]![i - 1 - 126]! - 1;
      }
      if (i - 1 - 252 >= 0 && close[j]![i - 1 - 252]! > 0) {
        mom12[j]![i] = close[j]![i - 1 - 21]! / close[j]![i - 1 - 252]! - 1;
      }
      vol[j]![i] = Math.max(0.08, stdev(ret[j]!, Math.max(1, i - 21), i) * SQRT252);
      const bFrom = Math.max(1, i - 60);
      const bn = i - bFrom;
      if (bn >= 20) {
        let sx = 0,
          sy = 0,
          syy = 0,
          sxy = 0;
        for (let k = bFrom; k < i; k++) {
          const x = ret[j]![k]!;
          const y = spyRet[k]!;
          sx += x;
          sy += y;
          syy += y * y;
          sxy += y * x;
        }
        const den = syy - (sy * sy) / bn;
        beta[j]![i] = den > 1e-12 ? (sxy - (sy * sx) / bn) / den : 1;
      }
    }
  }
  const sectors = Array.from(new Set(DATA.sectors));
  const sectorOf = DATA.sectors.map((s) => sectors.indexOf(s));
  const oos0 = dates.findIndex((d) => d >= OOS);
  return {
    dates,
    tickers,
    n,
    t,
    oos0: oos0 < 0 ? 800 : oos0,
    ret,
    spyRet,
    mom21,
    mom126,
    mom12,
    vol,
    beta,
    spyMom12,
    spyVol20,
    spyQ80,
    sectorOf,
    sectors,
  };
}

function engine() {
  return (cached ??= buildEngine());
}

function slope(xs: number[], ys: number[]) {
  const n = xs.length;
  if (n < 40) return 0;
  let sx = 0,
    sy = 0,
    sxx = 0,
    sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i]!;
    sy += ys[i]!;
    sxx += xs[i]! * xs[i]!;
    sxy += xs[i]! * ys[i]!;
  }
  const den = sxx - (sx * sx) / n;
  return den < 1e-12 ? 0 : (sxy - (sx * sy) / n) / den;
}

function neutralize(eng: Engine, t: number, raw: number[]) {
  const { n, sectorOf, sectors, beta, spyMom12 } = eng;
  const out = raw.slice();
  for (let s = 0; s < sectors.length; s++) {
    const vals: number[] = [];
    for (let i = 0; i < n; i++) if (sectorOf[i] === s) vals.push(raw[i]!);
    if (!vals.length) continue;
    const med = quantile(vals, 0.5);
    for (let i = 0; i < n; i++) if (sectorOf[i] === s) out[i]! -= med;
  }
  const spyM = spyMom12[t]!;
  for (let i = 0; i < n; i++) out[i]! -= 0.5 * beta[i]![t]! * spyM;
  return out;
}

function quintileLongShort(signal: number[]) {
  const n = signal.length;
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => signal[a]! - signal[b]!);
  const rank = Array(n).fill(0.5);
  for (let i = 0; i < n; i++) rank[order[i]!] = n === 1 ? 0.5 : i / (n - 1);
  const out = Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    if (rank[i]! >= 0.8) out[i] = 1;
    else if (rank[i]! <= 0.2) out[i] = -1;
  }
  return out as number[];
}

function rawSignal(eng: Engine, cfg: BookConfig, t: number) {
  const { n, mom126, mom12 } = eng;
  const out = Array(n);
  for (let i = 0; i < n; i++) out[i] = cfg.crossSectional ? mom12[i]![t]! : mom126[i]![t]!;
  return cfg.crossSectional ? neutralize(eng, t, out) : out;
}

function signedSignal(eng: Engine, cfg: BookConfig, t: number) {
  const raw = rawSignal(eng, cfg, t);
  return cfg.crossSectional ? quintileLongShort(raw) : raw.map(sign);
}

function walkForwardIc(eng: Engine, cfg: BookConfig, t: number) {
  const from = Math.max(260, t - 756);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = from; i < t; i += 5) {
    const sig = rawSignal(eng, cfg, i);
    for (let j = 0; j < eng.n; j++) {
      xs.push(sig[j]!);
      ys.push(eng.ret[j]![i]!);
    }
  }
  return slope(xs, ys);
}

function dollarNeutral(raw: number[]) {
  let long = 0,
    short = 0;
  for (const w of raw) {
    if (w > 0) long += w;
    else if (w < 0) short += -w;
  }
  const out = Array(raw.length).fill(0);
  for (let i = 0; i < raw.length; i++) {
    if (raw[i]! > 0 && long > 0) out[i] = (raw[i]! / long) * 0.5;
    else if (raw[i]! < 0 && short > 0) out[i] = (raw[i]! / short) * 0.5;
  }
  return out as number[];
}

function volTarget(eng: Engine, w: number[], t: number, target: number) {
  const rets: number[] = [];
  const from = Math.max(eng.oos0, t - 21);
  for (let i = from; i < t; i++) {
    let r = 0;
    for (let j = 0; j < eng.n; j++) r += w[j]! * eng.ret[j]![i]!;
    rets.push(r);
  }
  const vol = stdev(rets, 0, rets.length) * SQRT252;
  if (vol < 1e-6) return w;
  const scale = Math.min(2.5, Math.max(0.25, target / vol));
  return w.map((x) => x * scale);
}

const cache = new Map<string, BacktestResult>();

export function runBacktest(cfg: BookConfig = EMPTY_CONFIG): BacktestResult {
  const key = configKey(cfg);
  const hit = cache.get(key);
  if (hit) return hit;
  const eng = engine();
  const { n, t, oos0, dates, ret, spyRet, spyVol20, spyQ80 } = eng;
  let prev = Array(n).fill(0) as number[];
  const pnl: number[] = [];
  const to: number[] = [];
  const equity: EquityPoint[] = [];
  let wealth = 1;
  let spyW = 1;
  let peak = 1;
  let ic = 0;
  let month = "";
  let w = Array(n).fill(0) as number[];
  let since = 0;
  for (let i = oos0; i < t - 1; i++) {
    const ym = dates[i]!.slice(0, 7);
    if (cfg.walkForward && ym !== month) {
      ic = walkForwardIc(eng, cfg, i);
      month = ym;
    }
    since++;
    if (since >= REBALANCE || i === oos0) {
      since = 0;
      let sig = signedSignal(eng, cfg, i);
      if (cfg.walkForward && ic <= 0) sig = sig.map(() => 0);
      if (cfg.costHurdle) {
        const raw = rawSignal(eng, cfg, i);
        for (let j = 0; j < n; j++) if (Math.abs(raw[j]!) < 0.08) sig[j] = 0;
      }
      w = dollarNeutral(sig);
      if (cfg.volTarget) w = volTarget(eng, w, i, cfg.volTarget);
    }
    let held = w;
    if (cfg.regimeFilter) {
      const active = held.filter((x) => x !== 0).length;
      const longFrac = held.filter((x) => x > 0).length / Math.max(1, active);
      if ((spyVol20[i]! > spyQ80[i]! && spyQ80[i]! > 0) || longFrac < 0.2 || longFrac > 0.8) {
        held = held.map(() => 0);
      }
    }
    if (cfg.drawdownBreaker) {
      const dd = wealth / peak - 1;
      const scale = dd < -0.1 ? 0 : dd < -0.06 ? 0.5 : 1;
      if (scale !== 1) held = held.map((x) => x * scale);
    }
    let r = 0,
      turnover = 0,
      shortGross = 0;
    for (let j = 0; j < n; j++) {
      r += held[j]! * ret[j]![i + 1]!;
      turnover += Math.abs(held[j]! - prev[j]!);
      if (held[j]! < 0) shortGross -= held[j]!;
      prev[j] = held[j]!;
    }
    const net = r - turnover * COST_BPS - shortGross * BORROW_DAILY;
    wealth *= 1 + net;
    if (wealth > peak) peak = wealth;
    spyW *= 1 + spyRet[i + 1]!;
    pnl.push(net);
    to.push(turnover);
    if (pnl.length % 5 === 1 || i === t - 2) {
      equity.push({ d: dates[i + 1]!, v: wealth, spy: spyW });
    }
  }
  const nDays = pnl.length;
  const mu = mean(pnl);
  const sd = stdev(pnl, 0, nDays);
  const sharpe = sd > 1e-12 ? (mu / sd) * SQRT252 : 0;
  let path = 1,
    pathPeak = 1,
    maxDd = 0,
    hits = 0;
  for (const p of pnl) {
    path *= 1 + p;
    if (path > pathPeak) pathPeak = path;
    maxDd = Math.min(maxDd, path / pathPeak - 1);
    if (p > 0) hits++;
  }
  const years = nDays / 252;
  const cagr = years > 0 && path > 0 ? path ** (1 / years) - 1 : 0;
  const result: BacktestResult = {
    sharpe,
    metrics: {
      sharpe,
      deflatedSharpe: sharpe * Math.sqrt(Math.max(0.45, 1 - (nTrials(cfg) - 1) / 36)),
      cagr,
      maxDd,
      turnover: mean(to) * 252,
      hitRate: nDays ? hits / nDays : 0,
      nDays,
      start: dates[oos0]!,
      end: dates[t - 1]!,
    },
    equity,
    config: cfg,
  };
  cache.set(key, result);
  return result;
}

export function marketMeta() {
  return {
    names: DATA.tickers.length,
    start: DATA.dates[0]!,
    end: DATA.dates[DATA.dates.length - 1]!,
    oos: OOS,
  };
}
