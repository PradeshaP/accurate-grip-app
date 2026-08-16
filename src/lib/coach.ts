/**
 * Real-time capture coaching.
 *
 * Pure functions that turn live frame statistics into a single actionable
 * instruction for the user, plus a rolling "beat acceptance" tracker so the
 * scanner can tell the difference between a usable second and a wasted one.
 */

export type CoachLevel = "good" | "warn" | "bad";

export interface CoachInput {
  /** mean red channel of the ROI (0-255) */
  red: number;
  /** mean green channel of the ROI (0-255) */
  green: number;
  /** fraction of pixels at/near 255 in the red channel (0-1) */
  clipped: number;
  /** short-window mean frame-to-frame motion energy */
  motion: number;
  /** short-window peak motion energy */
  motionPeak: number;
  /** live AC/DC perfusion estimate, in % */
  perfusion: number;
  /** measured camera frame rate */
  fps: number;
  /** fraction of recent frames accepted into the record (0-1) */
  acceptance: number;
}

export interface CoachState {
  level: CoachLevel;
  /** short imperative instruction */
  message: string;
  /** machine-readable cause, useful for analytics/tests */
  code:
    | "ok"
    | "no-finger"
    | "too-light"
    | "clipping"
    | "motion"
    | "drift"
    | "weak-pulse"
    | "low-fps";
}

/** Frames dirtier than this are never worth keeping. */
export const MOTION_DROP = 3.2;
/** Above this, coaching escalates to a hard "hold still". */
export const MOTION_BAD = 5.5;

/**
 * Decides the single most useful thing to tell the user right now.
 * Ordering matters: fix the blocking problem first, then the fine-tuning ones.
 */
export function coach(i: CoachInput): CoachState {
  if (i.red < 80 || i.red - i.green < 14) {
    return {
      level: "bad",
      code: "no-finger",
      message: "Cover the camera and flash fully with your fingertip",
    };
  }
  if (i.clipped > 0.25 || i.red > 248) {
    return {
      level: "bad",
      code: "clipping",
      message: "Press lighter — the image is blown out",
    };
  }
  if (i.motionPeak > MOTION_BAD || i.motion > MOTION_DROP) {
    return {
      level: "bad",
      code: "motion",
      message: "Hold still — rest your hand and phone on a table",
    };
  }
  if (i.red < 110) {
    return {
      level: "warn",
      code: "too-light",
      message: "Press a little firmer for a brighter signal",
    };
  }
  if (i.perfusion > 0 && i.perfusion < 0.35) {
    return {
      level: "warn",
      code: "weak-pulse",
      message: "Weak pulse — warm your hand and relax your finger",
    };
  }
  if (i.motion > MOTION_DROP * 0.55 || i.acceptance < 0.7) {
    return {
      level: "warn",
      code: "drift",
      message: "Slight drift — keep your finger perfectly still",
    };
  }
  if (i.fps > 0 && i.fps < 18) {
    return {
      level: "warn",
      code: "low-fps",
      message: "Camera is slow — close other apps for best accuracy",
    };
  }
  return { level: "good", code: "ok", message: "Excellent signal — keep holding" };
}

/** Rolling window helper for live statistics. */
export class Rolling {
  private buf: number[] = [];
  constructor(private size: number) {}
  push(v: number) {
    this.buf.push(v);
    if (this.buf.length > this.size) this.buf.shift();
  }
  clear() {
    this.buf = [];
  }
  get length() {
    return this.buf.length;
  }
  mean() {
    if (!this.buf.length) return 0;
    return this.buf.reduce((s, v) => s + v, 0) / this.buf.length;
  }
  max() {
    return this.buf.length ? Math.max(...this.buf) : 0;
  }
  min() {
    return this.buf.length ? Math.min(...this.buf) : 0;
  }
  range() {
    return this.buf.length ? this.max() - this.min() : 0;
  }
}
