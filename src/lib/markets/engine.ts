import raw from "./us-equities.json";
import {
  BASELINE_CONFIG,
  configKey,
  trialCount,
  type EquityPt,
  type EvalResult,
  type StrategyConfig,
} from "./types";

type RawPanel = {
  dates: string[];
  tickers: string[];
  sectors: string[];
  adv: number[];
  close: number[][];
  spy: number[];
};

const panel = raw as RawPanel;

const ONE_WAY = 0.0005; // 5 bps on mega-caps
const BORROW = 0.02 / 252;
const OOS = "2019-01-02";
const SQRT_252 = Math.sqrt(252);
const REBALANCE = 5; // weekly, on daily bars

type Feat = {
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

let feat: Feat | null = null;
const evalCache = new Map<string, EvalResult>();

function stdev(xs: number[], a: number, b: number): number {
  const n = b - a;
  if (n < 2) return 0;
  let m = 0;
  for (let i = a; i < b; i++) m += xs[i];
  m /= n;
  let v = 0;
  for (let i = a; i < b; i++) {
    const d = xs[i] - m;
    v += d * d;
  }
  return Math.sqrt(v / (n - 1));
}

function mean(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function percentile(xs: number[], q: number): number {
  if (!xs.length) return 0;
  const s = xs.slice().sort((a, b) => a - b);
  const i = (s.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  if (lo === hi) return s[lo];
  return s[lo] * (hi - i) + s[hi] * (i - lo);
}

function sign(x: number): number {
  return x > 0 ? 1 : x < 0 ? -1 : 0;
}

export function universeInfo() {
  return {
    names: panel.tickers.length,
    start: panel.dates[0],
    end: panel.dates[panel.dates.length - 1],
    oos: OOS,
  };
}

function buildFeat(): Feat {
  const dates = panel.dates;
  const tickers = panel.tickers;
  const n = tickers.length;
  const t = dates.length;
  const close = panel.close;
  const spy = panel.spy;
  const ret: number[][] = Array.from({ length: n }, () => new Array(t).fill(0));
  const spyRet = new Array(t).fill(0);
  for (let k = 1; k < t; k++) {
    spyRet[k] = spy[k] / spy[k - 1] - 1;
    for (let i = 0; i < n; i++) {
      const p0 = close[i][k - 1];
      ret[i][k] = p0 > 0 ? close[i][k] / p0 - 1 : 0;
    }
  }

  const mom21: number[][] = Array.from({ length: n }, () => new Array(t).fill(0));
  const mom126: number[][] = Array.from({ length: n }, () => new Array(t).fill(0));
  const mom12: number[][] = Array.from({ length: n }, () => new Array(t).fill(0));
  const vol: number[][] = Array.from({ length: n }, () => new Array(t).fill(0));
  const beta: number[][] = Array.from({ length: n }, () => new Array(t).fill(1));
  const spyMom12 = new Array(t).fill(0);
  const spyVol20 = new Array(t).fill(0);
  const spyQ80 = new Array(t).fill(0);

  for (let k = 1; k < t; k++) {
    if (k - 1 - 252 >= 0) spyMom12[k] = spy[k - 1 - 21] / spy[k - 1 - 252] - 1;
    const v0 = Math.max(1, k - 20);
    spyVol20[k] = stdev(spyRet, v0, k) * SQRT_252;
    const q0 = Math.max(1, k - 252);
    const window: number[] = [];
    for (let j = q0; j < k; j++) window.push(spyVol20[j]);
    spyQ80[k] = percentile(window, 0.8);
    for (let i = 0; i < n; i++) {
      if (k - 1 - 21 >= 0 && close[i][k - 1 - 21] > 0) {
        mom21[i][k] = close[i][k - 1] / close[i][k - 1 - 21] - 1;
      }
      if (k - 1 - 126 >= 0 && close[i][k - 1 - 126] > 0) {
        mom126[i][k] = close[i][k - 1] / close[i][k - 1 - 126] - 1;
      }
      if (k - 1 - 252 >= 0 && close[i][k - 1 - 252] > 0) {
        mom12[i][k] = close[i][k - 1 - 21] / close[i][k - 1 - 252] - 1;
      }
      vol[i][k] = Math.max(0.08, stdev(ret[i], Math.max(1, k - 21), k) * SQRT_252);
      const b0 = Math.max(1, k - 60);
      const len = k - b0;
      if (len >= 20) {
        let sy = 0;
        let sx = 0;
        let sxx = 0;
        let sxy = 0;
        for (let j = b0; j < k; j++) {
          const y = ret[i][j];
          const x = spyRet[j];
          sy += y;
          sx += x;
          sxx += x * x;
          sxy += x * y;
        }
        const varx = sxx - (sx * sx) / len;
        beta[i][k] = varx > 1e-12 ? (sxy - (sx * sy) / len) / varx : 1;
      }
    }
  }

  const sectorNames = Array.from(new Set(panel.sectors));
  const sectorOf = panel.sectors.map((s) => sectorNames.indexOf(s));
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
    sectors: sectorNames,
  };
}

function getFeat(): Feat {
  if (!feat) feat = buildFeat();
  return feat;
}

function olsSlope(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 40) return 0;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += x[i];
    sy += y[i];
    sxx += x[i] * x[i];
    sxy += x[i] * y[i];
  }
  const varx = sxx - (sx * sx) / n;
  if (varx < 1e-12) return 0;
  return (sxy - (sx * sy) / n) / varx;
}

function residualize(f: Feat, k: number, raw: number[]): number[] {
  const { n, sectorOf, sectors, beta, spyMom12 } = f;
  const out = raw.slice();
  for (let s = 0; s < sectors.length; s++) {
    const vals: number[] = [];
    for (let i = 0; i < n; i++) if (sectorOf[i] === s) vals.push(raw[i]);
    if (!vals.length) continue;
    const med = percentile(vals, 0.5);
    for (let i = 0; i < n; i++) if (sectorOf[i] === s) out[i] -= med;
  }
  const spyF = spyMom12[k];
  for (let i = 0; i < n; i++) out[i] -= 0.5 * beta[i][k] * spyF;
  return out;
}

function rankSignal(values: number[]): number[] {
  const n = values.length;
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => values[a] - values[b]);
  const rank = new Array(n).fill(0.5);
  for (let r = 0; r < n; r++) rank[idx[r]] = n === 1 ? 0.5 : r / (n - 1);
  const sig = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    if (rank[i] >= 0.8) sig[i] = 1;
    else if (rank[i] <= 0.2) sig[i] = -1;
  }
  return sig;
}

function monthKey(d: string): string {
  return d.slice(0, 7);
}

function featureVector(f: Feat, cfg: StrategyConfig, k: number): number[] {
  const { n, mom126, mom12 } = f;
  const raw = new Array(n);
  for (let i = 0; i < n; i++) raw[i] = cfg.crossSectional ? mom12[i][k] : mom126[i][k];
  return cfg.crossSectional ? residualize(f, k, raw) : raw;
}

function signalsAt(f: Feat, cfg: StrategyConfig, k: number, slope: number | null): number[] {
  const featVec = featureVector(f, cfg, k);
  if (cfg.crossSectional) return rankSignal(featVec);
  return featVec.map(sign);
}

function fitIc(f: Feat, cfg: StrategyConfig, k: number): number {
  const train0 = Math.max(260, k - 756);
  const x: number[] = [];
  const y: number[] = [];
  for (let j = train0; j < k; j += 5) {
    const fv = featureVector(f, cfg, j);
    for (let i = 0; i < f.n; i++) {
      x.push(fv[i]);
      y.push(f.ret[i][j]);
    }
  }
  return olsSlope(x, y);
}

function toWeights(sig: number[]): number[] {
  const n = sig.length;
  let long = 0;
  let short = 0;
  for (let i = 0; i < n; i++) {
    if (sig[i] > 0) long += sig[i];
    else if (sig[i] < 0) short += -sig[i];
  }
  const w = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    if (sig[i] > 0 && long > 0) w[i] = (sig[i] / long) * 0.5;
    else if (sig[i] < 0 && short > 0) w[i] = (sig[i] / short) * 0.5;
  }
  return w;
}

function scaleBookVol(f: Feat, w: number[], k: number, target: number): number[] {
  const pnls: number[] = [];
  const a = Math.max(f.oos0, k - 21);
  for (let j = a; j < k; j++) {
    let p = 0;
    for (let i = 0; i < f.n; i++) p += w[i] * f.ret[i][j];
    pnls.push(p);
  }
  const pv = stdev(pnls, 0, pnls.length) * SQRT_252;
  if (pv < 1e-6) return w;
  const scale = Math.min(2.5, Math.max(0.25, target / pv));
  return w.map((x) => x * scale);
}

export function evaluate(cfg: StrategyConfig = BASELINE_CONFIG): EvalResult {
  const key = configKey(cfg);
  const hit = evalCache.get(key);
  if (hit) return hit;

  const f = getFeat();
  const { n, t, oos0, dates, ret, spyRet, spyVol20, spyQ80 } = f;
  const prev = new Array(n).fill(0);
  const daily: number[] = [];
  const traded: number[] = [];
  const eqPts: EquityPt[] = [];
  let equity = 1;
  let spyEq = 1;
  let peak = 1;
  let ic = 0;
  let lastMonth = "";
  let held = new Array(n).fill(0);
  let sinceReb = 0;

  for (let k = oos0; k < t - 1; k++) {
    const mk = monthKey(dates[k]);
    if (cfg.walkForward && mk !== lastMonth) {
      ic = fitIc(f, cfg, k);
      lastMonth = mk;
    }

    sinceReb++;
    const doReb = sinceReb >= REBALANCE || k === oos0;
    if (doReb) {
      sinceReb = 0;
      let sig = signalsAt(f, cfg, k, ic);
      if (cfg.walkForward && ic <= 0) {
        sig = sig.map(() => 0);
      }
      if (cfg.costHurdle) {
        const fv = featureVector(f, cfg, k);
        for (let i = 0; i < n; i++) {
          if (Math.abs(fv[i]) < 0.08) sig[i] = 0;
        }
      }
      held = toWeights(sig);
      if (cfg.volTarget) held = scaleBookVol(f, held, k, cfg.volTarget);
    }

    let w = held;
    if (cfg.regimeFilter) {
      const active = w.filter((x) => x !== 0).length;
      const pos = w.filter((x) => x > 0).length / Math.max(1, active);
      const chop = spyVol20[k] > spyQ80[k] && spyQ80[k] > 0;
      if (chop || pos < 0.2 || pos > 0.8) w = w.map(() => 0);
    }
    if (cfg.drawdownBreaker) {
      const dd = equity / peak - 1;
      const scale = dd < -0.1 ? 0 : dd < -0.06 ? 0.5 : 1;
      if (scale !== 1) w = w.map((x) => x * scale);
    }

    let gross = 0;
    let turn = 0;
    let short = 0;
    for (let i = 0; i < n; i++) {
      gross += w[i] * ret[i][k + 1];
      turn += Math.abs(w[i] - prev[i]);
      if (w[i] < 0) short -= w[i];
      prev[i] = w[i];
    }
    const net = gross - turn * ONE_WAY - short * BORROW;
    equity *= 1 + net;
    if (equity > peak) peak = equity;
    spyEq *= 1 + spyRet[k + 1];
    daily.push(net);
    traded.push(turn);
    if (daily.length % 5 === 1 || k === t - 2) {
      eqPts.push({ d: dates[k + 1], v: equity, spy: spyEq });
    }
  }

  const nDays = daily.length;
  const mu = mean(daily);
  const sd = stdev(daily, 0, nDays);
  const sharpe = sd > 1e-12 ? (mu / sd) * SQRT_252 : 0;
  let eq = 1;
  let pk = 1;
  let maxDd = 0;
  let hits = 0;
  for (const r of daily) {
    eq *= 1 + r;
    if (eq > pk) pk = eq;
    maxDd = Math.min(maxDd, eq / pk - 1);
    if (r > 0) hits++;
  }
  const years = nDays / 252;
  const cagr = years > 0 && eq > 0 ? eq ** (1 / years) - 1 : 0;
  const hair = Math.sqrt(Math.max(0.45, 1 - (trialCount(cfg) - 1) / 36));
  const result: EvalResult = {
    sharpe,
    metrics: {
      sharpe,
      deflatedSharpe: sharpe * hair,
      cagr,
      maxDd,
      turnover: mean(traded) * 252,
      hitRate: nDays ? hits / nDays : 0,
      nDays,
      start: dates[oos0],
      end: dates[t - 1],
    },
    equity: eqPts,
    config: cfg,
  };
  evalCache.set(key, result);
  return result;
}

export function formatSharpe(n: number): string {
  return n.toFixed(2);
}

export function formatPctSigned(n: number): string {
  const signStr = n > 0 ? "+" : "";
  return `${signStr}${(n * 100).toFixed(1)}%`;
}
