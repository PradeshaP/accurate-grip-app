import { useEffect, useRef } from "react";

/** Live oscilloscope-style PPG trace rendered on a canvas. */
export function Waveform({
  data,
  secondary,
  height = 130,
  live = false,
}: {
  data: number[];
  secondary?: number[];
  height?: number;
  live?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = canvas.clientWidth;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const styles = getComputedStyle(document.documentElement);
    const grid = styles.getPropertyValue("--border").trim() || "#334";
    const c1 = styles.getPropertyValue("--signal").trim() || "#4dd";
    const c2 = styles.getPropertyValue("--signal-alt").trim() || "#fa4";

    ctx.strokeStyle = grid;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const draw = (series: number[], color: string, alpha: number) => {
      if (series.length < 2) return;
      let min = Infinity;
      let max = -Infinity;
      for (const v of series) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
      const span = max - min || 1;
      ctx.beginPath();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      series.forEach((v, i) => {
        const x = (i / (series.length - 1)) * width;
        const y = height - 8 - ((v - min) / span) * (height - 16);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    if (secondary) draw(secondary, c2, 0.65);
    draw(data, c1, 1);
  }, [data, secondary, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ height, width: "100%" }}
      className={`w-full rounded-xl bg-background/60 ${live ? "ring-1 ring-primary/30" : ""}`}
      aria-hidden="true"
    />
  );
}
