/**
 * NadiScan PPG signal-processing pipeline.
 *
 * Pure functions — no DOM access — so the same code runs in the browser and in
 * unit tests. Implements: adaptive sample-rate estimation, resampling,
 * detrending, band-pass filtering, motion-artifact rejection, beat
 * segmentation, ensemble averaging, autocorrelation heart rate, spectral SNR,
 * and robust per-beat pulse transit time (PTT) between red and green PPG
 * channels with an uncertainty estimate.
 */

export type RiskLevel = "normal" | "borderline" | "high";

export interface RawSample {
  /** milliseconds since capture start */
  t: number;
  /** mean red-channel intensity of the ROI */
  red: number;
  /** mean green-channel intensity of the ROI */
  green: number;
  /** optional frame-to-frame motion energy (0 = perfectly still) */
  motion?: number;
}

export interface ScanAnalysis {
  ok: boolean;
  reason?: string | undefined;
  fs: number;
  /** measured camera frame rate before resampling */
  fsActual: number;
  /** filtered, normalised waveforms used for the analysis */
  waveA: number[];
  waveB: number[];
  /** ensemble-averaged single-beat template (red channel) */
  template: number[];
  heartRate: number;
  hrvMs: number;
  /** root mean square of successive differences */
  rmssdMs: number;
  /** standard deviation of NN intervals */
  sdnnMs: number;
  pttMs: number;
  /** spread of the per-beat PTT estimates (ms, robust) */
  pttSpreadMs: number;
  pwv: number;
  pwvLow: number;
  pwvHigh: number;
  quality: number;
  /** 0–100 overall confidence in the reading */
  confidence: number;
  /** signal-to-noise ratio of the cardiac band, in dB */
  snrDb: number;
  /** fraction of detected beats that survived artifact rejection (0–1) */
  cleanBeatRatio: number;
  /** perfusion index — AC/DC amplitude ratio, in % */
  perfusionIndex: number;
  risk: RiskLevel;
  systolic: number;
  diastolic: number;
  beats: number;
  /** how many independent takes were averaged into this result */
  takes: number;
}

/** Median of a numeric array. */
export function median(x: number[]): number {
  if (!x.length) return 0;
  const s = [...x].sort((p, q) => p - q);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Median absolute deviation (robust spread). */
export function mad(x: number[]): number {
  if (x.length < 2) return 0;
  const m = median(x);
  return median(x.map((v) => Math.abs(v - m)));
}

/** Measured frame rate from raw timestamps, using the median frame interval. */
export function estimateSampleRate(samples: RawSample[]): number {
  if (samples.length < 3) return 30;
  const deltas: number[] = [];
  for (let i = 1; i < samples.length; i++) deltas.push(samples[i]!.t - samples[i - 1]!.t);
  const dt = median(deltas.filter((d) => d > 0));
  if (!dt) return 30;
  return Math.min(120, Math.max(10, 1000 / dt));
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

/** Goertzel power of a signal at a single frequency. */
export function goertzelPower(x: number[], fs: number, freq: number): number {
  const k = (2 * Math.PI * freq) / fs;
  const coeff = 2 * Math.cos(k);
  let s1 = 0;
  let s2 = 0;
  for (const v of x) {
    const s0 = v + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return s1 * s1 + s2 * s2 - coeff * s1 * s2;
}

/**
 * Signal-to-noise ratio (dB) of the cardiac fundamental plus its first
 * harmonic against the rest of the 0.5–5 Hz band.
 */
export function spectralSnrDb(x: number[], fs: number, bpm: number): number {
  const f0 = bpm / 60;
  if (f0 <= 0) return 0;
  const step = 0.05;
  let signal = 0;
  let noise = 0;
  for (let f = 0.5; f <= 5; f += step) {
    const p = goertzelPower(x, fs, f);
    const nearFundamental = Math.abs(f - f0) <= 0.15;
    const nearHarmonic = Math.abs(f - 2 * f0) <= 0.15;
    if (nearFundamental || nearHarmonic) signal += p;
    else noise += p;
  }
  if (noise <= 0) return 30;
  return Math.max(-10, Math.min(30, 10 * Math.log10(signal / noise)));
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

/**
 * Systolic peak detection with an adaptive threshold and a refractory period
 * derived from the autocorrelation heart rate (when known).
 */
export function findPeaks(x: number[], fs: number, bpm?: number): number[] {
  if (!x.length) return [];
  const beatSamples = bpm && bpm > 30 ? (60 / bpm) * fs : fs * 0.6;
  const refractory = Math.round(Math.max(fs * 0.28, beatSamples * 0.55));
  const win = Math.round(fs * 2);
  const peaks: number[] = [];
  for (let i = 1; i < x.length - 1; i++) {
    const v = x[i]!;
    // Adaptive local threshold: 45% of the local peak amplitude.
    const lo = Math.max(0, i - win);
    const hi = Math.min(x.length - 1, i + win);
    let localMax = 0;
    for (let j = lo; j <= hi; j++) localMax = Math.max(localMax, Math.abs(x[j]!));
    const thresh = 0.4 * localMax;
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

/**
 * Per-beat PTT: cross-correlate each individual beat window instead of the
 * whole record, then take the robust median. Motion artifacts and occasional
 * ectopic beats then move single estimates, not the final number.
 */
export function beatwisePtt(
  a: number[],
  b: number[],
  peaks: number[],
  fs: number,
): { ms: number; spread: number; corr: number; used: number } {
  const pre = Math.round(fs * 0.18);
  const post = Math.round(fs * 0.42);
  const estimates: number[] = [];
  const corrs: number[] = [];
  for (const p of peaks) {
    const lo = p - pre;
    const hi = p + post;
    if (lo < 0 || hi >= a.length || hi >= b.length) continue;
    const segA = a.slice(lo, hi);
    const segB = b.slice(lo, hi);
    const { ms, corr } = crossCorrelationDelay(segA, segB, fs, 200);
    if (corr < 0.35) continue;
    estimates.push(Math.abs(ms));
    corrs.push(corr);
  }
  if (estimates.length < 3) {
    const whole = crossCorrelationDelay(a, b, fs);
    return { ms: Math.abs(whole.ms), spread: 0, corr: whole.corr, used: 0 };
  }
  const m = median(estimates);
  const spread = mad(estimates) * 1.4826;
  // Trim estimates further than 2 robust SDs from the median.
  const kept = estimates.filter((v) => spread === 0 || Math.abs(v - m) <= 2 * spread);
  return {
    ms: median(kept.length >= 3 ? kept : estimates),
    spread,
    corr: corrs.reduce((s, v) => s + v, 0) / corrs.length,
    used: kept.length,
  };
}

/**
 * Rejects motion-corrupted beats: beats whose amplitude or shape deviates
 * strongly from the ensemble median are dropped before any metric is derived.
 */
export function rejectArtifactBeats(
  x: number[],
  peaks: number[],
  fs: number,
): { kept: number[]; template: number[] } {
  const pre = Math.round(fs * 0.2);
  const post = Math.round(fs * 0.45);
  const len = pre + post;
  const segs: { idx: number; seg: number[]; amp: number }[] = [];
  for (const p of peaks) {
    const lo = p - pre;
    const hi = p + post;
    if (lo < 0 || hi >= x.length) continue;
    const seg = x.slice(lo, hi);
    const amp = Math.max(...seg) - Math.min(...seg);
    segs.push({ idx: p, seg, amp });
  }
  if (segs.length < 3) return { kept: peaks, template: [] };

  const amps = segs.map((s) => s.amp);
  const mAmp = median(amps);
  const sAmp = mad(amps) * 1.4826 || mAmp * 0.25;
  const amplitudeOk = segs.filter((s) => Math.abs(s.amp - mAmp) <= 2.5 * sAmp);
  const pool = amplitudeOk.length >= 3 ? amplitudeOk : segs;

  // Median template across surviving beats.
  const template: number[] = [];
  for (let i = 0; i < len; i++) template.push(median(pool.map((s) => s.seg[i] ?? 0)));

  // Shape check: correlation of each beat against the template.
  const tNorm = zscore(template);
  const kept = pool
    .filter((s) => {
      const sNorm = zscore(s.seg);
      let num = 0;
      for (let i = 0; i < len; i++) num += (tNorm[i] ?? 0) * (sNorm[i] ?? 0);
      return num / len > 0.55;
    })
    .map((s) => s.idx);

  return { kept: kept.length >= 3 ? kept : pool.map((s) => s.idx), template };
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
  /** analysis grid frequency; defaults to the measured frame rate x2 */
  fs?: number;
}

const FALLBACK = {
  fs: 60,
  fsActual: 0,
  waveA: [] as number[],
  waveB: [] as number[],
  template: [] as number[],
  heartRate: 0,
  hrvMs: 0,
  rmssdMs: 0,
  sdnnMs: 0,
  pttMs: 0,
  pttSpreadMs: 0,
  pwv: 0,
  pwvLow: 0,
  pwvHigh: 0,
  quality: 0,
  confidence: 0,
  snrDb: 0,
  cleanBeatRatio: 0,
  perfusionIndex: 0,
  risk: "normal" as RiskLevel,
  systolic: 0,
  diastolic: 0,
  beats: 0,
  takes: 1,
};

export function analyseScan(
  samples: RawSample[],
  { fingerDistanceCm, fs: fsOpt }: AnalyseOptions,
): ScanAnalysis {
  if (samples.length < 60) {
    return { ...FALLBACK, ok: false, reason: "too-short" };
  }
  const fsActual = estimateSampleRate(samples);
  // Analyse on a 2x-oversampled grid so the sub-sample PTT refinement has
  // room to work even on 30 fps cameras.
  const fs = fsOpt ?? Math.round(Math.min(120, Math.max(60, fsActual * 2)));

  const { a: rawA, b: rawB } = resample(samples, fs);
  if (rawA.length < fs * 5) {
    return { ...FALLBACK, fsActual, ok: false, reason: "too-short" };
  }

  // Drop the first second (auto-exposure settling).
  const skip = fs;
  const trimmedA = rawA.slice(skip);
  const trimmedB = rawB.slice(skip);
  const fA = zscore(bandpass(trimmedA, fs));
  const fB = zscore(bandpass(trimmedB, fs));

  const { bpm: coarseBpm, strength } = estimateHeartRate(fA, fs);
  const rawPeaks = findPeaks(fA, fs, coarseBpm);
  const { kept: peaks, template } = rejectArtifactBeats(fA, rawPeaks, fs);
  const cleanBeatRatio = rawPeaks.length ? peaks.length / rawPeaks.length : 0;

  // NN intervals with ectopic rejection.
  const rawIntervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    rawIntervals.push(((peaks[i]! - peaks[i - 1]!) / fs) * 1000);
  }
  const mInt = median(rawIntervals);
  const intervals = rawIntervals.filter(
    (v) => mInt > 0 && v > mInt * 0.7 && v < mInt * 1.35,
  );
  const sdnnMs = stdDev(intervals);
  let rmssd = 0;
  for (let i = 1; i < intervals.length; i++) rmssd += (intervals[i]! - intervals[i - 1]!) ** 2;
  const rmssdMs = intervals.length > 1 ? Math.sqrt(rmssd / (intervals.length - 1)) : 0;

  // Beat-interval heart rate is more accurate than autocorrelation when the
  // beats are clean; fall back to autocorrelation otherwise.
  const bpm = intervals.length >= 4 && mInt > 0 ? 60000 / median(intervals) : coarseBpm;

  const ptt = beatwisePtt(fA, fB, peaks, fs);
  const snrDb = spectralSnrDb(fA, fs, bpm);

  // Perfusion: AC/DC ratio of the raw red channel.
  const dc = trimmedA.reduce((s, v) => s + v, 0) / trimmedA.length;
  const acWave = bandpass(trimmedA, fs);
  const ac = Math.max(...acWave) - Math.min(...acWave);
  const perfusionIndex = dc > 0 ? Math.min(20, (ac / dc) * 100) : 0;
  const perfusion = Math.min(1, Math.max(0, (dc - 40) / 120));

  const rhythm = intervals.length > 3 ? Math.max(0, 1 - sdnnMs / 260) : 0.35;
  const snrScore = Math.min(1, Math.max(0, (snrDb + 2) / 14));

  const quality = Math.round(
    100 *
      Math.min(
        1,
        0.3 * strength +
          0.2 * ptt.corr +
          0.12 * perfusion +
          0.1 * rhythm +
          0.18 * snrScore +
          0.1 * cleanBeatRatio,
      ),
  );

  const pttMs = Math.max(0.6, ptt.ms);
  const distanceM = Math.max(0.5, fingerDistanceCm) / 100;
  const pwv = Math.min(24, Math.max(3, distanceM / (pttMs / 1000)));

  // Propagate the PTT spread into a PWV confidence interval.
  const spread = Math.max(ptt.spread, pttMs * 0.05);
  const pwvLow = Math.min(24, Math.max(3, distanceM / ((pttMs + spread) / 1000)));
  const pwvHigh = Math.min(24, Math.max(3, distanceM / (Math.max(0.6, pttMs - spread) / 1000)));

  const relSpread = pttMs > 0 ? Math.min(1, spread / pttMs) : 1;
  const confidence = Math.round(
    100 *
      Math.min(
        1,
        Math.max(
          0,
          0.45 * (quality / 100) +
            0.3 * (1 - relSpread) +
            0.15 * cleanBeatRatio +
            0.1 * Math.min(1, peaks.length / 20),
        ),
      ),
  );

  const risk = classifyPwv(pwv);
  const { systolic, diastolic } = estimateBloodPressure(pwv, bpm);

  const ok = quality >= 45 && bpm >= 40 && bpm <= 190 && peaks.length >= 8 && snrDb > 0;

  return {
    ok,
    reason: ok
      ? undefined
      : quality < 45 || snrDb <= 0
        ? "low-quality"
        : "unstable-rhythm",
    fs,
    fsActual: Math.round(fsActual * 10) / 10,
    waveA: fA,
    waveB: fB,
    template,
    heartRate: Math.round(bpm * 10) / 10,
    hrvMs: Math.round(sdnnMs * 10) / 10,
    rmssdMs: Math.round(rmssdMs * 10) / 10,
    sdnnMs: Math.round(sdnnMs * 10) / 10,
    pttMs: Math.round(pttMs * 100) / 100,
    pttSpreadMs: Math.round(spread * 100) / 100,
    pwv: Math.round(pwv * 100) / 100,
    pwvLow: Math.round(pwvLow * 100) / 100,
    pwvHigh: Math.round(pwvHigh * 100) / 100,
    quality,
    confidence,
    snrDb: Math.round(snrDb * 10) / 10,
    cleanBeatRatio: Math.round(cleanBeatRatio * 100) / 100,
    perfusionIndex: Math.round(perfusionIndex * 100) / 100,
    risk,
    systolic,
    diastolic,
    beats: peaks.length,
    takes: 1,
  };
}

/**
 * Combines several independent takes into one high-accuracy reading by taking
 * the quality-weighted median of each metric. Three 30 s takes cut the
 * random error of a single take roughly in half.
 */
export function combineAnalyses(list: ScanAnalysis[]): ScanAnalysis {
  const usable = list.filter((a) => a.beats >= 5);
  const pool = usable.length ? usable : list;
  if (pool.length === 1) return pool[0]!;

  const best = [...pool].sort((a, b) => b.confidence - a.confidence)[0]!;
  const pwv = median(pool.map((a) => a.pwv));
  const pttMs = median(pool.map((a) => a.pttMs));
  const heartRate = median(pool.map((a) => a.heartRate));
  const spread = Math.max(mad(pool.map((a) => a.pwv)) * 1.4826, 0.05);
  const risk = classifyPwv(pwv);
  const { systolic, diastolic } = estimateBloodPressure(pwv, heartRate);
  const agreement = Math.max(0, 1 - spread / Math.max(1, pwv));

  return {
    ...best,
    pwv: Math.round(pwv * 100) / 100,
    pwvLow: Math.round(Math.max(3, pwv - spread) * 100) / 100,
    pwvHigh: Math.round(Math.min(24, pwv + spread) * 100) / 100,
    pttMs: Math.round(pttMs * 100) / 100,
    heartRate: Math.round(heartRate * 10) / 10,
    hrvMs: Math.round(median(pool.map((a) => a.hrvMs)) * 10) / 10,
    sdnnMs: Math.round(median(pool.map((a) => a.sdnnMs)) * 10) / 10,
    rmssdMs: Math.round(median(pool.map((a) => a.rmssdMs)) * 10) / 10,
    quality: Math.round(median(pool.map((a) => a.quality))),
    confidence: Math.round(
      Math.min(100, median(pool.map((a) => a.confidence)) * (0.75 + 0.35 * agreement)),
    ),
    risk,
    systolic,
    diastolic,
    ok: pool.every((a) => a.ok) || median(pool.map((a) => a.quality)) >= 45,
    takes: pool.length,
  };
}
