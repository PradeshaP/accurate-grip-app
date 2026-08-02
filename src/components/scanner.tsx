import { useCallback, useEffect, useRef, useState } from "react";
import { analyseScan, type RawSample, type ScanAnalysis } from "@/lib/ppg";
import { useI18n } from "@/lib/i18n";
import { Waveform } from "@/components/waveform";

const DURATION_MS = 30_000;

/** Torch is a non-standard MediaTrackConstraint supported by most Android browsers. */
function torchConstraint(on: boolean): MediaTrackConstraints {
  return { advanced: [{ torch: on }] } as unknown as MediaTrackConstraints;
}

type Phase = "idle" | "starting" | "capturing" | "analysing" | "error";

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

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(DURATION_MS / 1000);
  const [live, setLive] = useState<number[]>([]);
  const [coverage, setCoverage] = useState(0);

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
  }, []);

  useEffect(() => stopStream, [stopStream]);

  const finish = useCallback(() => {
    stopStream();
    setPhase("analysing");
    const samples = samplesRef.current;
    // Allow the UI to paint the analysing state before the sync computation.
    window.setTimeout(() => {
      const analysis = analyseScan(samples, { fingerDistanceCm });
      setPhase("idle");
      onResult(analysis);
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

  const start = useCallback(async () => {
    setError(null);
    samplesRef.current = [];
    setLive([]);
    setPhase("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 },
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
      const video = videoRef.current;
      if (!video) throw new Error("no-video");
      video.srcObject = stream;
      await video.play();

      const canvas = canvasRef.current ?? document.createElement("canvas");
      canvasRef.current = canvas;
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("no-canvas");

      startRef.current = performance.now();
      setPhase("capturing");

      const tick = () => {
        const now = performance.now();
        const elapsed = now - startRef.current;
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
          for (let i = 0; i < data.length; i += 4) {
            r += data[i]!;
            g += data[i + 1]!;
          }
          r /= px;
          g /= px;
          samplesRef.current.push({ t: elapsed, red: r, green: g });
          if (samplesRef.current.length % 3 === 0) {
            setCoverage(Math.round(Math.min(100, Math.max(0, ((r - 55) / 130) * 100))));
            setLive(samplesRef.current.slice(-160).map((s) => s.red));
          }
        }
        setRemaining(Math.max(0, Math.ceil((DURATION_MS - elapsed) / 1000)));
        if (elapsed >= DURATION_MS) {
          finish();
          return;
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
  }, [finish, stopStream, t]);

  const cancel = useCallback(() => {
    stopStream();
    setPhase("idle");
    setLive([]);
  }, [stopStream]);

  const capturing = phase === "capturing";
  const progress = capturing ? 1 - remaining / (DURATION_MS / 1000) : 0;

  return (
    <div className="panel p-5 sm:p-7">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">{t("scan.title")}</h2>
        <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
          30 s · 30 fps
        </span>
      </div>

      <div className="relative mt-5 overflow-hidden rounded-2xl border border-border bg-background/70">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`h-44 w-full object-cover transition-opacity ${capturing ? "opacity-70" : "opacity-0"}`}
        />
        {!capturing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
              <span className="pulse-ring absolute inset-0 rounded-full border border-primary/60" />
              <span className="h-3 w-3 rounded-full bg-primary" />
            </div>
            <p className="text-sm text-muted-foreground">{t("scan.place")}</p>
          </div>
        )}
        {capturing && (
          <div className="absolute inset-x-0 bottom-0 p-3">
            <Waveform data={live} height={70} live />
          </div>
        )}
      </div>

      {capturing && (
        <div className="mt-4 space-y-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {remaining} {t("scan.remaining")}
            </span>
            <span className={coverage > 45 ? "text-risk-normal" : "text-risk-borderline"}>
              {t("scan.quality")} {coverage}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {coverage > 45 ? t("scan.good") : t("scan.weak")}
          </p>
        </div>
      )}

      {phase === "analysing" && (
        <p className="mt-4 text-sm text-primary">{t("scan.analyzing")}</p>
      )}
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <div className="mt-5 flex flex-wrap gap-3">
        {capturing ? (
          <button
            onClick={cancel}
            className="rounded-xl border border-border px-5 py-3 text-sm font-medium hover:bg-secondary"
          >
            {t("scan.stop")}
          </button>
        ) : (
          <button
            onClick={start}
            disabled={phase === "starting" || phase === "analysing"}
            className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-90 disabled:opacity-50"
          >
            {t("scan.start")}
          </button>
        )}
        <button
          onClick={runDemo}
          disabled={capturing || phase === "analysing"}
          className="rounded-xl border border-border px-5 py-3 text-sm font-medium text-muted-foreground hover:bg-secondary disabled:opacity-50"
        >
          {t("scan.demo")}
        </button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{t("scan.hold")}</p>
    </div>
  );
}
