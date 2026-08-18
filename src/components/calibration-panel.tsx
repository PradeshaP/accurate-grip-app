import { useState } from "react";
import {
  addCuffPoint,
  anchorFrom,
  clearCalibration,
  loadCalibration,
  removeCuffPoint,
  type CalibrationState,
} from "@/lib/calibration";
import type { ScanAnalysis } from "@/lib/ppg";

const SOURCE_LABEL: Record<string, string> = {
  cuff: "Calibrated to your cuff readings",
  baseline: "Anchored to your personal baseline",
  reference: "Healthy population reference (uncalibrated)",
};

/**
 * Lets a user pair the current scan with a real cuff blood-pressure reading.
 * Two or three points taken on different days give the best accuracy.
 */
export function CalibrationPanel({
  analysis,
  onChange,
}: {
  analysis: ScanAnalysis;
  onChange: (state: CalibrationState) => void;
}) {
  const [state, setState] = useState<CalibrationState>(() => loadCalibration());
  const [sys, setSys] = useState("");
  const [dia, setDia] = useState("");
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const anchor = anchorFrom(state, analysis.pttMs);

  const push = (next: CalibrationState) => {
    setState(next);
    onChange(next);
  };

  const submit = () => {
    const s = Number(sys);
    const d = Number(dia);
    if (!(s >= 70 && s <= 250) || !(d >= 40 && d <= 150) || d >= s) {
      setMsg("Enter a realistic cuff reading, e.g. 118 / 76.");
      return;
    }
    push(
      addCuffPoint({
        pttMs: analysis.pttMs,
        systolic: s,
        diastolic: d,
        heartRate: analysis.heartRate,
      }),
    );
    setSys("");
    setDia("");
    setMsg("Saved — this scan is now calibrated against your cuff.");
  };

  return (
    <div className="mt-5 rounded-2xl border border-border bg-background/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Calibration</p>
          <p className="mt-1 text-sm">
            {SOURCE_LABEL[anchor.source]}
            {anchor.points > 0 ? ` · ${anchor.points} reference point(s)` : ""}
          </p>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-secondary"
        >
          {open ? "Close" : "Calibrate with a cuff"}
        </button>
      </div>

      {open && (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Measure your arm with a normal BP cuff right after this scan and enter it below. The
            app then reports pressure relative to that reference instead of a generic model.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-muted-foreground">
              Systolic
              <input
                value={sys}
                onChange={(e) => setSys(e.target.value)}
                inputMode="numeric"
                placeholder="118"
                className="mt-1 block w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Diastolic
              <input
                value={dia}
                onChange={(e) => setDia(e.target.value)}
                inputMode="numeric"
                placeholder="76"
                className="mt-1 block w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
            <button
              onClick={submit}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90"
            >
              Save reference
            </button>
            {state.points.length > 0 && (
              <button
                onClick={() => {
                  clearCalibration();
                  push(loadCalibration());
                  setMsg("Calibration cleared.");
                }}
                className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-secondary"
              >
                Reset all
              </button>
            )}
          </div>
          {msg && <p className="text-xs text-muted-foreground">{msg}</p>}

          {state.points.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {state.points.map((p, i) => (
                <li key={p.at} className="flex items-center gap-3">
                  <span>
                    {new Date(p.at).toLocaleDateString()} · {p.systolic}/{p.diastolic} mmHg @ PTT{" "}
                    {p.pttMs.toFixed(2)} ms
                  </span>
                  <button
                    onClick={() => push(removeCuffPoint(i))}
                    className="underline hover:text-foreground"
                  >
                    remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
