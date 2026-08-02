/**
 * NadiScan PPG signal-processing pipeline.
 *
 * Pure functions — no DOM access — so the same code runs in the browser and in
 * unit tests. Implements: resampling, detrending, band-pass filtering,
 * peak detection, autocorrelation heart rate, and cross-correlation based
 * pulse transit time (PTT) between the red and green PPG channels.
 */

export type RiskLevel = "normal" | "borderline" | "high";

export interface RawSample {
  /** milliseconds since capture start */
  t: number;
  /** mean red-channel intensity of the ROI */
  red: number;
  /** mean green-channel intensity of the ROI */
  green: number;
}

export interface ScanAnalysis {
  ok: boolean;
  reason?: string | undefined;
  fs: number;
  /** filtered, normalised waveforms used for the analysis */
  waveA: number[];
  waveB: number[];
  heartRate: number;
  hrvMs: number;
  pttMs: number;
  pwv: number;
  quality: number;
  risk: RiskLevel;
  systolic: number;
  diastolic: number;
  beats: number;
}

/** Uniform-grid resampling (linear interpolation). */
export function resample(
  samples: RawSample[],
  fs: number,
): { a: number[]; b: number[]; fs: number } {
  const a: number[] = [];
  const b: number[] = [];
  if (samples.length < 2) return { a, b, fs };
  const t0 = samples[0]!.t;
  const t1 = samples[samples.length - 1]!.t;
  const step = 1000 / fs;
  let i = 0;
  for (let t = t0; t <= t1; t += step) {
    while (i < samples.length - 2 && samples[i + 1]!.t < t) i++;
    const s0 = samples[i]!;
    const s1 = samples[i + 1]!;
    const span = s1.t - s0.t || 1;
    const w = Math.min(1, Math.max(0, (t - s0.t) / span));
    a.push(s0.red + (s1.red - s0.red) * w);
    b.push(s0.green + (s1.green - s0.green) * w);
  }
  return { a, b, fs };
}

/** Centred moving average. */
export function movingAverage(x: number[], win: number): number[] {
  const half = Math.max(1, Math.floor(win / 2));
  const out = new Array<number>(x.length);
  for (let i = 0; i < x.length; i++) {
    const lo = Math.max(0, i - half);
    const hi = Math.min(x.length - 1, i + half);
    let sum = 0;
    for (let j = lo; j <= hi; j++) sum += x[j]!;
    out[i] = sum / (hi - lo + 1);
  }
  return out;
}

/**
 * Band-pass 0.7–3.5 Hz (42–210 bpm) built from two moving averages:
 * subtracting a long window removes baseline drift, a short window removes
 * sensor noise. Robust and dependency-free.
 */
export function bandpass(x: number[], fs: number): number[] {
  const longWin = Math.round(fs / 0.7);
  const shortWin = Math.max(2, Math.round(fs / 6));
  const base = movingAverage(x, longWin);
  const hp = x.map((v, i) => v - base[i]!);
  return movingAverage(hp, shortWin);
}

export function zscore(x: number[]): number[] {
  if (!x.length) return x;
  const mean = x.reduce((s, v) => s + v, 0) / x.length;
  const sd =
    Math.sqrt(x.reduce((s, v) => s + (v - mean) * (v - mean), 0) / x.length) || 1;
  return x.map((v) => (v - mean) / sd);
}

/** Sample standard deviation. */
export function stdDev(x: number[]): number {
  if (x.length < 2) return 0;
  const mean = x.reduce((s, v) => s + v, 0) / x.length;
  return Math.sqrt(x.reduce((s, v) => s + (v - mean) ** 2, 0) / (x.length - 1));
}

/** Normalised autocorrelation at a given lag. */
function autocorr(x: number[], lag: number): number {
  let num = 0;
  let d1 = 0;
  let d2 = 0;
  for (let i = 0; i + lag < x.length; i++) {
    const xi = x[i]!;
    const xj = x[i + lag]!;
    num += xi * xj;
    d1 += xi * xi;
    d2 += xj * xj;
  }
  const den = Math.sqrt(d1 * d2) || 1;
  return num / den;
}

/** Parabolic interpolation around a discrete peak index. */
function refinePeak(y0: number, y1: number, y2: number): number {
  const den = y0 - 2 * y1 + y2;
  if (Math.abs(den) < 1e-12) return 0;
  return (0.5 * (y0 - y2)) / den;
}

/** Heart rate (bpm) via autocorrelation of the filtered waveform. */
export function estimateHeartRate(
  x: number[],
  fs: number,
): { bpm: number; strength: number } {
  const minLag = Math.floor(fs / 3.3); // ~198 bpm
  const maxLag = Math.ceil(fs / 0.7); // ~42 bpm
  let bestLag = minLag;
  let best = -Infinity;
  const curve: number[] = [];
  for (let lag = minLag; lag <= maxLag && lag < x.length - 2; lag++) {
    const c = autocorr(x, lag);
    curve.push(c);
    if (c > best) {
      best = c;
      bestLag = lag;
    }
  }
  const idx = bestLag - minLag;
  let frac = 0;
  if (idx > 0 && idx < curve.length - 1) {
    frac = refinePeak(curve[idx - 1]!, curve[idx]!, curve[idx + 1]!);
  }
  const lag = bestLag + frac;
  const bpm = (60 * fs) / lag;
  return { bpm, strength: Math.max(0, best) };
}

/** Systolic peak detection with a refractory period. */
export function findPeaks(x: number[], fs: number): number[] {
  if (!x.length) return [];
  const refractory = Math.round(fs * 0.33);
  let maxAbs = 0;
  for (const v of x) maxAbs = Math.max(maxAbs, Math.abs(v));
  const thresh = 0.35 * maxAbs;
  const peaks: number[] = [];
  for (let i = 1; i < x.length - 1; i++) {
    const v = x[i]!;
    if (v > thresh && v >= x[i - 1]! && v > x[i + 1]!) {
      const last = peaks[peaks.length - 1];
      if (last !== undefined && i - last < refractory) {
        if (v > x[last]!) peaks[peaks.length - 1] = i;
      } else {
        peaks.push(i);
      }
    }
  }
  return peaks;
}

/**
 * Pulse transit time between two PPG channels via time-domain
 * cross-correlation with sub-sample parabolic refinement.
 */
export function crossCorrelationDelay(
  a: number[],
  b: number[],
  fs: number,
  maxLagMs = 220,
): { ms: number; corr: number } {
  const maxLag = Math.max(2, Math.round((maxLagMs / 1000) * fs));
  const values: number[] = [];
  let bestIdx = 0;
  let best = -Infinity;
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    let num = 0;
    let d1 = 0;
    let d2 = 0;
    for (let i = 0; i < a.length; i++) {
      const j = i + lag;
      if (j < 0 || j >= b.length) continue;
      const ai = a[i]!;
      const bj = b[j]!;
      num += ai * bj;
      d1 += ai * ai;
      d2 += bj * bj;
    }
    const c = num / (Math.sqrt(d1 * d2) || 1);
    values.push(c);
    if (c > best) {
      best = c;
      bestIdx = values.length - 1;
    }
  }
  let frac = 0;
  if (bestIdx > 0 && bestIdx < values.length - 1) {
    frac = refinePeak(values[bestIdx - 1]!, values[bestIdx]!, values[bestIdx + 1]!);
  }
  const lagSamples = bestIdx - maxLag + frac;
  return { ms: (lagSamples / fs) * 1000, corr: Math.max(0, best) };
}

export function classifyPwv(pwv: number): RiskLevel {
  if (pwv < 8) return "normal";
  if (pwv < 10) return "borderline";
  return "high";
}

/**
 * Estimated brachial pressure from arterial stiffness.
 * Linear PWV↔BP relation from the ESC/ESH arterial-stiffness literature.
 * Screening estimate — not a diagnosis.
 */
export function estimateBloodPressure(pwv: number, hr: number) {
  const systolic = 70 + 5.4 * pwv + 0.12 * (hr - 70);
  const diastolic = 52 + 2.2 * pwv + 0.06 * (hr - 70);
  return {
    systolic: Math.round(Math.min(210, Math.max(85, systolic))),
    diastolic: Math.round(Math.min(130, Math.max(50, diastolic))),
  };
}

export interface AnalyseOptions {
  /** centre-to-centre distance between the two sensing points, in cm */
  fingerDistanceCm: number;
  /** analysis grid frequency */
  fs?: number;
}

const FALLBACK = {
  fs: 60,
  waveA: [] as number[],
  waveB: [] as number[],
  heartRate: 0,
  hrvMs: 0,
  pttMs: 0,
  pwv: 0,
  quality: 0,
  risk: "normal" as RiskLevel,
  systolic: 0,
  diastolic: 0,
  beats: 0,
};

export function analyseScan(
  samples: RawSample[],
  { fingerDistanceCm, fs = 60 }: AnalyseOptions,
): ScanAnalysis {
  if (samples.length < 60) {
    return { ...FALLBACK, ok: false, reason: "too-short" };
  }
  const { a: rawA, b: rawB } = resample(samples, fs);
  if (rawA.length < fs * 5) {
    return { ...FALLBACK, ok: false, reason: "too-short" };
  }

  // Drop the first second (auto-exposure settling).
  const skip = fs;
  const fA = zscore(bandpass(rawA.slice(skip), fs));
  const fB = zscore(bandpass(rawB.slice(skip), fs));

  const { bpm, strength } = estimateHeartRate(fA, fs);
  const peaks = findPeaks(fA, fs);
  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push(((peaks[i]! - peaks[i - 1]!) / fs) * 1000);
  }
  const hrvMs = stdDev(intervals);

  const { ms, corr } = crossCorrelationDelay(fA, fB, fs);

  // Perfusion: a finger fully covering the lens under torch light produces a
  // high, saturated red DC level.
  const dc = rawA.reduce((s, v) => s + v, 0) / rawA.length;
  const perfusion = Math.min(1, Math.max(0, (dc - 40) / 120));
  const rhythm = intervals.length > 3 ? Math.max(0, 1 - hrvMs / 260) : 0.35;

  const quality = Math.round(
    100 * Math.min(1, 0.42 * strength + 0.3 * corr + 0.16 * perfusion + 0.12 * rhythm),
  );

  const pttMs = Math.max(0.6, Math.abs(ms));
  const distanceM = Math.max(0.5, fingerDistanceCm) / 100;
  const pwv = Math.min(24, Math.max(3, distanceM / (pttMs / 1000)));
  const risk = classifyPwv(pwv);
  const { systolic, diastolic } = estimateBloodPressure(pwv, bpm);

  const ok = quality >= 45 && bpm >= 40 && bpm <= 190 && peaks.length >= 5;

  return {
    ok,
    reason: ok ? undefined : quality < 45 ? "low-quality" : "unstable-rhythm",
    fs,
    waveA: fA,
    waveB: fB,
    heartRate: Math.round(bpm * 10) / 10,
    hrvMs: Math.round(hrvMs * 10) / 10,
    pttMs: Math.round(pttMs * 100) / 100,
    pwv: Math.round(pwv * 100) / 100,
    quality,
    risk,
    systolic,
    diastolic,
    beats: peaks.length,
  };
}
