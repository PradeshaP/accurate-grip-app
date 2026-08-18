/**
 * Personal calibration layer.
 *
 * A two-point fingertip PPG measures a *relative* transit time, not an
 * absolute aortic PWV: the raw channel delay depends on the phone, the torch,
 * the sensor separation and skin tone. Feeding that raw number straight into
 * an absolute PWV formula makes almost every reading fall outside the healthy
 * band, which is why uncalibrated devices report "high" for everybody.
 *
 * Instead we anchor the reading:
 *   1. against a real cuff blood-pressure reading if the user provides one
 *      (highest accuracy — the recommended path), or
 *   2. against the person's own rolling baseline transit time, which makes the
 *      first reading land on a normal reference (PWV 7.0 m/s) and later
 *      readings move relative to it.
 *
 * Everything is stored locally on the device — no personal BP leaves the phone.
 */
import { classifyPwv, type ScanAnalysis } from "@/lib/ppg";

const KEY = "nadiscan.calibration.v1";

/** PWV a healthy adult sits at — the anchor for an uncalibrated device. */
export const REFERENCE_PWV = 7.0;
/** mmHg change per 100 % change in the transit-time ratio. */
const SBP_GAIN = 45;
const DBP_GAIN = 24;

export interface CuffPoint {
  pttMs: number;
  systolic: number;
  diastolic: number;
  heartRate: number;
  at: string;
}

export interface CalibrationState {
  /** cuff reference points measured alongside a scan */
  points: CuffPoint[];
  /** rolling personal baseline transit time (ms) */
  baselinePttMs: number | null;
  /** number of scans folded into the baseline */
  baselineCount: number;
}

const EMPTY: CalibrationState = { points: [], baselinePttMs: null, baselineCount: 0 };

export function loadCalibration(): CalibrationState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<CalibrationState>;
    return {
      points: Array.isArray(parsed.points) ? parsed.points : [],
      baselinePttMs: typeof parsed.baselinePttMs === "number" ? parsed.baselinePttMs : null,
      baselineCount: typeof parsed.baselineCount === "number" ? parsed.baselineCount : 0,
    };
  } catch {
    return EMPTY;
  }
}

function persist(state: CalibrationState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage disabled — calibration stays in-memory for this session */
  }
}

export function clearCalibration() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

/** Adds a cuff reading measured right after a scan. Up to 8 points are kept. */
export function addCuffPoint(point: Omit<CuffPoint, "at">): CalibrationState {
  const state = loadCalibration();
  const next: CalibrationState = {
    ...state,
    points: [...state.points, { ...point, at: new Date().toISOString() }].slice(-8),
  };
  persist(next);
  return next;
}

export function removeCuffPoint(index: number): CalibrationState {
  const state = loadCalibration();
  const next = { ...state, points: state.points.filter((_, i) => i !== index) };
  persist(next);
  return next;
}

/** Folds a completed scan into the personal baseline transit time. */
export function learnBaseline(pttMs: number): CalibrationState {
  const state = loadCalibration();
  if (!(pttMs > 0)) return state;
  const count = Math.min(state.baselineCount, 19) + 1;
  const prev = state.baselinePttMs ?? pttMs;
  const next: CalibrationState = {
    ...state,
    baselinePttMs: prev + (pttMs - prev) / count,
    baselineCount: count,
  };
  persist(next);
  return next;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  if (!sorted.length) return 0;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export interface CalibrationAnchor {
  pttRefMs: number;
  systolicRef: number;
  diastolicRef: number;
  source: "cuff" | "baseline" | "reference";
  points: number;
}

/** Reference point the current model is anchored on. */
export function anchorFrom(state: CalibrationState, pttMs: number): CalibrationAnchor {
  if (state.points.length) {
    return {
      pttRefMs: median(state.points.map((p) => p.pttMs)),
      systolicRef: Math.round(median(state.points.map((p) => p.systolic))),
      diastolicRef: Math.round(median(state.points.map((p) => p.diastolic))),
      source: "cuff",
      points: state.points.length,
    };
  }
  const baseline = state.baselinePttMs ?? pttMs;
  return {
    pttRefMs: baseline > 0 ? baseline : pttMs,
    // Population reference that pairs with REFERENCE_PWV.
    systolicRef: 118,
    diastolicRef: 76,
    source: state.baselinePttMs ? "baseline" : "reference",
    points: 0,
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function pwvForSystolic(systolic: number) {
  // Inverse of the PWV→SBP screening relation used across the app.
  return clamp((systolic - 70) / 5.4, 3.5, 18);
}

/**
 * Re-expresses a raw analysis through the personal anchor. The transit-time
 * ratio drives every derived number, so an uncalibrated first scan lands on the
 * healthy reference instead of defaulting to "high".
 */
export function applyCalibration(analysis: ScanAnalysis, state = loadCalibration()): ScanAnalysis {
  if (!analysis.pttMs || analysis.pttMs <= 0) return analysis;
  const anchor = anchorFrom(state, analysis.pttMs);
  if (!(anchor.pttRefMs > 0)) return analysis;

  // Shorter transit time = stiffer artery = higher pressure.
  const ratio = clamp(anchor.pttRefMs / analysis.pttMs, 0.6, 1.7);
  const delta = ratio - 1;

  const systolic = Math.round(clamp(anchor.systolicRef + SBP_GAIN * delta, 85, 200));
  const diastolic = Math.round(
    clamp(Math.min(systolic - 25, anchor.diastolicRef + DBP_GAIN * delta), 50, 125),
  );

  const refPwv =
    anchor.source === "cuff" ? pwvForSystolic(anchor.systolicRef) : REFERENCE_PWV;
  const pwv = clamp(refPwv * ratio, 3.5, 18);

  const spreadRatio = analysis.pttSpreadMs / analysis.pttMs;
  const band = clamp(pwv * Math.max(spreadRatio, 0.04), 0.15, 4);

  return {
    ...analysis,
    pwv: Math.round(pwv * 100) / 100,
    pwvLow: Math.round(clamp(pwv - band, 3.5, 18) * 100) / 100,
    pwvHigh: Math.round(clamp(pwv + band, 3.5, 18) * 100) / 100,
    risk: classifyPwv(pwv),
    systolic,
    diastolic,
    calibration: anchor.source,
    calibrationPoints: anchor.points,
  };
}
