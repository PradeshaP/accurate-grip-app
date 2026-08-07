import { useCallback, useEffect, useRef, useState } from "react";
import { analyseScan, combineAnalyses, type RawSample, type ScanAnalysis } from "@/lib/ppg";
import { useI18n } from "@/lib/i18n";
import { Waveform } from "@/components/waveform";

const DURATION_MS = 30_000;
const REST_MS = 4_000;

/** Torch is a non-standard MediaTrackConstraint supported by most Android browsers. */
function torchConstraint(on: boolean): MediaTrackConstraints {
  return { advanced: [{ torch: on }] } as unknown as MediaTrackConstraints;
}

type Phase = "idle" | "starting" | "detecting" | "capturing" | "resting" | "analysing" | "error";

interface Props {
  fingerDistanceCm: number;
  onResult: (a: ScanAnalysis) => void;
}

/** Generates a physiologically shaped dual-channel PPG signal for demo mode. */
function syntheticSamples(): RawSample[] {
  const out: RawSample[] = [];
  const fps = 30;
  const hr = 68 + Math.random() * 24;
  const ptt = 0.02 + Math.random() * 0.05; // seconds of delay on the green channel
  const beat = 60 / hr;
  const wave = (phase: number) =>
    Math.exp(-((phase % 1) ** 2) * 26) * 1.0 +
    0.35 * Math.exp(-(((phase % 1) - 0.32) ** 2) * 90);
  for (let i = 0; i < (DURATION_MS / 1000) * fps; i++) {
    const t = i / fps;
    const drift = 3 * Math.sin(t * 0.25);
    out.push({
      t: t * 1000,
      red: 168 + drift + 9 * wave(t / beat) + (Math.random() - 0.5) * 0.8,
      green: 96 + drift + 5.5 * wave((t - ptt) / beat) + (Math.random() - 0.5) * 0.9,
    });
  }
  return out;
}

export function Scanner({ fingerDistanceCm, onResult }: Props) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const samplesRef = useRef<RawSample[]>([]);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const prevFrameRef = useRef<Float32Array | null>(null);
  const takesRef = useRef<ScanAnalysis[]>([]);
  const targetTakesRef = useRef(1);
  const detectStableRef = useRef(0);
  const frameCountRef = useRef(0);
  const lastFpsAtRef = useRef(0);

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(DURATION_MS / 1000);
  const [live, setLive] = useState<number[]>([]);
  const [coverage, setCoverage] = useState(0);
  const [stability, setStability] = useState(100);
  const [fps, setFps] = useState(0);
  const [takeIndex, setTakeIndex] = useState(0);
  const [highAccuracy, setHighAccuracy] = useState(true);

  const stopStream = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) {
        try {
          track.applyConstraints(torchConstraint(false));
        } catch {
          /* torch unsupported */
        }
        track.stop();
      }
    }
    streamRef.current = null;
    prevFrameRef.current = null;
  }, []);

  useEffect(() => stopStream, [stopStream]);

  const startRef2 = useRef<(() => Promise<void>) | null>(null);

  const finishTake = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setPhase("analysing");
    const samples = samplesRef.current;
    window.setTimeout(() => {
      const analysis = analyseScan(samples, { fingerDistanceCm });
      takesRef.current.push(analysis);
      if (takesRef.current.length < targetTakesRef.current) {
        setTakeIndex(takesRef.current.length);
        setPhase("resting");
        window.setTimeout(() => {
          void startRef2.current?.();
        }, REST_MS);
        return;
      }
      stopStream();
      setPhase("idle");
      onResult(combineAnalyses(takesRef.current));
    }, 80);
  }, [fingerDistanceCm, onResult, stopStream]);

  const runDemo = useCallback(() => {
    setError(null);
    setPhase("analysing");
    window.setTimeout(() => {
      const analysis = analyseScan(syntheticSamples(), { fingerDistanceCm });
      setPhase("idle");
      onResult(analysis);
    }, 900);
  }, [fingerDistanceCm, onResult]);

  const beginCapture = useCallback(async () => {
    setError(null);
    samplesRef.current = [];
    prevFrameRef.current = null;
    detectStableRef.current = 0;
    frameCountRef.current = 0;
    setLive([]);
    setPhase("starting");
    try {
      let stream = streamRef.current;
      if (!stream || !stream.active) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 60 },
          },
          audio: false,
        });
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        try {
          await track?.applyConstraints(torchConstraint(true));
        } catch {
          /* device has no torch — ambient light still works */
        }
        // Lock exposure/white balance where supported: auto-gain fights the
        // tiny AC component we are trying to measure.
        try {
          await track?.applyConstraints({
            advanced: [{ exposureMode: "manual", whiteBalanceMode: "manual", focusMode: "manual" }],
          } as unknown as MediaTrackConstraints);
        } catch {
          /* fixed-mode constraints unsupported */
        }
        const video = videoRef.current;
        if (!video) throw new Error("no-video");
        video.srcObject = stream;
        await video.play();
      }

      const video = videoRef.current;
      if (!video) throw new Error("no-video");

      const canvas = canvasRef.current ?? document.createElement("canvas");
      canvasRef.current = canvas;
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("no-canvas");

      setPhase("detecting");
      lastFpsAtRef.current = performance.now();

      const tick = () => {
        const now = performance.now();
        if (video.videoWidth > 0) {
          const side = Math.min(video.videoWidth, video.videoHeight) * 0.5;
          ctx.drawImage(
            video,
            (video.videoWidth - side) / 2,
            (video.videoHeight - side) / 2,
            side,
            side,
            0,
            0,
            64,
            64,
          );
          const { data } = ctx.getImageData(0, 0, 64, 64);
          let r = 0;
          let g = 0;
          const px = data.length / 4;
          const lum = new Float32Array(px);
          for (let i = 0, k = 0; i < data.length; i += 4, k++) {
            const rv = data[i]!;
            const gv = data[i + 1]!;
            r += rv;
            g += gv;
            lum[k] = rv * 0.5 + gv * 0.5;
          }
          r /= px;
          g /= px;

          // Frame-to-frame motion energy (normalised).
          let motion = 0;
          const prev = prevFrameRef.current;
          if (prev) {
            let acc = 0;
            for (let i = 0; i < px; i++) acc += Math.abs(lum[i]! - prev[i]!);
            motion = acc / px;
          }
          prevFrameRef.current = lum;

          // Finger present = bright, saturated red with low green.
          const fingerOn = r > 90 && r - g > 18;
          const cov = Math.round(Math.min(100, Math.max(0, ((r - 55) / 130) * 100)));
          setCoverage(cov);
          setStability(Math.round(Math.max(0, Math.min(100, 100 - motion * 12))));

          frameCountRef.current++;
          if (now - lastFpsAtRef.current > 800) {
            setFps(Math.round((frameCountRef.current * 1000) / (now - lastFpsAtRef.current)));
            frameCountRef.current = 0;
            lastFpsAtRef.current = now;
          }

          if (phaseRef.current === "detecting") {
            detectStableRef.current = fingerOn ? detectStableRef.current + 1 : 0;
            if (detectStableRef.current > 20) {
              startRef.current = now;
              samplesRef.current = [];
              setPhaseSync("capturing");
            }
          } else if (phaseRef.current === "capturing") {
            const elapsed = now - startRef.current;
            // Motion-corrupted frames are dropped rather than filtered later.
            if (motion < 6) samplesRef.current.push({ t: elapsed, red: r, green: g, motion });
            if (samplesRef.current.length % 3 === 0) {
              setLive(samplesRef.current.slice(-160).map((s) => s.red));
            }
            setRemaining(Math.max(0, Math.ceil((DURATION_MS - elapsed) / 1000)));
            if (elapsed >= DURATION_MS) {
              finishTake();
              return;
            }
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      stopStream();
      setPhase("error");
      setError(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? t("scan.permission")
          : t("scan.noCamera"),
      );
    }
  }, [finishTake, stopStream, t]);

  // Keep a ref mirror of the phase so the rAF loop reads fresh values.
  const phaseRef = useRef<Phase>("idle");
  const setPhaseSync = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  startRef2.current = beginCapture;

  const start = useCallback(() => {
    takesRef.current = [];
    setTakeIndex(0);
    targetTakesRef.current = highAccuracy ? 3 : 1;
    void beginCapture();
  }, [beginCapture, highAccuracy]);

  const cancel = useCallback(() => {
    stopStream();
    takesRef.current = [];
    setPhaseSync("idle");
    setLive([]);
  }, [setPhaseSync, stopStream]);

  const capturing = phase === "capturing";
  const detecting = phase === "detecting";
  const progress = capturing ? 1 - remaining / (DURATION_MS / 1000) : 0;
  const busy = capturing || detecting || phase === "analysing" || phase === "resting";

  return (
    <div className="panel p-5 sm:p-7">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">{t("scan.title")}</h2>
        <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
          {targetTakesRef.current > 1 ? `${targetTakesRef.current} × 30 s` : "30 s"}
          {fps ? ` · ${fps} fps` : ""}
        </span>
      </div>

      <div className="relative mt-5 overflow-hidden rounded-2xl border border-border bg-background/70">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`h-44 w-full object-cover transition-opacity ${busy ? "opacity-70" : "opacity-0"}`}
        />
        {!busy && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
              <span className="pulse-ring absolute inset-0 rounded-full border border-primary/60" />
              <span className="h-3 w-3 rounded-full bg-primary" />
            </div>
            <p className="text-sm text-muted-foreground">{t("scan.place")}</p>
          </div>
        )}
        {(detecting || phase === "resting") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/70 px-6 text-center">
            <span className="pulse-ring h-8 w-8 rounded-full border-2 border-primary" />
            <p className="text-sm font-medium">
              {phase === "resting"
                ? `Take ${takeIndex + 1} of ${targetTakesRef.current} — relax, next take starts automatically`
                : "Detecting fingertip… hold still until the pulse locks"}
            </p>
          </div>
        )}
        {capturing && (
          <div className="absolute inset-x-0 bottom-0 p-3">
            <Waveform data={live} height={70} live />
          </div>
        )}
      </div>

      {(capturing || detecting) && (
        <div className="mt-4 space-y-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">
              {capturing
                ? `${remaining} ${t("scan.remaining")}${targetTakesRef.current > 1 ? ` · take ${takeIndex + 1}/${targetTakesRef.current}` : ""}`
                : "waiting for finger"}
            </span>
            <span className={coverage > 45 ? "text-risk-normal" : "text-risk-borderline"}>
              {t("scan.quality")} {coverage}%
            </span>
            <span className={stability > 80 ? "text-risk-normal" : "text-risk-high"}>
              stability {stability}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {stability <= 80
              ? "Too much movement — rest your hand on a table."
              : coverage > 45
                ? t("scan.good")
                : t("scan.weak")}
          </p>
        </div>
      )}

      {phase === "analysing" && (
        <p className="mt-4 text-sm text-primary">{t("scan.analyzing")}</p>
      )}
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <label className="mt-5 flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={highAccuracy}
          disabled={busy}
          onChange={(e) => setHighAccuracy(e.target.checked)}
          className="h-4 w-4 accent-[hsl(var(--primary))]"
        />
        <span>
          High-accuracy mode — 3 consecutive takes, median-combined
          <span className="ml-1 text-xs text-muted-foreground">(≈2 min, halves the error)</span>
        </span>
      </label>

      <div className="mt-4 flex flex-wrap gap-3">
        {busy ? (
          <button
            onClick={cancel}
            className="rounded-xl border border-border px-5 py-3 text-sm font-medium hover:bg-secondary"
          >
            {t("scan.stop")}
          </button>
        ) : (
          <button
            onClick={start}
            disabled={phase === "starting"}
            className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-90 disabled:opacity-50"
          >
            {t("scan.start")}
          </button>
        )}
        <button
          onClick={runDemo}
          disabled={busy}
          className="rounded-xl border border-border px-5 py-3 text-sm font-medium text-muted-foreground hover:bg-secondary disabled:opacity-50"
        >
          {t("scan.demo")}
        </button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{t("scan.hold")}</p>
    </div>
  );
}
