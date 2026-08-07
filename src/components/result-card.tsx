import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import type { ScanAnalysis } from "@/lib/ppg";
import { Waveform } from "@/components/waveform";

const RISK_STYLES = {
  normal: {
    text: "text-risk-normal",
    ring: "border-risk-normal/50 bg-risk-normal/10",
    bar: "bg-risk-normal",
  },
  borderline: {
    text: "text-risk-borderline",
    ring: "border-risk-borderline/50 bg-risk-borderline/10",
    bar: "bg-risk-borderline",
  },
  high: {
    text: "text-risk-high",
    ring: "border-risk-high/50 bg-risk-high/10",
    bar: "bg-risk-high",
  },
} as const;

interface Meta {
  ageBand: string;
  gender: string;
  district: string;
  state: string;
  role: string;
  fingerDistanceCm: number;
}

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/50 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl">
        {value}
        {unit ? <span className="ml-1 text-sm text-muted-foreground">{unit}</span> : null}
      </p>
    </div>
  );
}

export function ResultCard({
  analysis,
  meta,
  onNewScan,
}: {
  analysis: ScanAnalysis;
  meta: Meta;
  onNewScan: () => void;
}) {
  const { t, voice, lang } = useI18n();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const style = RISK_STYLES[analysis.risk];
  const riskLabel = t(`result.${analysis.risk}` as TranslationKey);
  const advice = t(
    (analysis.risk === "normal"
      ? "result.adviceNormal"
      : analysis.risk === "borderline"
        ? "result.adviceBorderline"
        : "result.adviceHigh") as TranslationKey,
  );

  const gaugePct = useMemo(
    () => Math.min(100, Math.max(4, ((analysis.pwv - 4) / 12) * 100)),
    [analysis.pwv],
  );

  const speak = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const utter = new SpeechSynthesisUtterance(`${riskLabel}. ${advice}`);
    utter.lang = voice;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    const { error } = await supabase.from("scan_records").insert({
      pwv: analysis.pwv,
      ptt_ms: analysis.pttMs,
      heart_rate: analysis.heartRate,
      hrv_ms: analysis.hrvMs,
      signal_quality: analysis.quality,
      risk_level: analysis.risk,
      est_systolic: analysis.systolic,
      est_diastolic: analysis.diastolic,
      age_band: meta.ageBand || null,
      gender: meta.gender || null,
      district: meta.district || null,
      state: meta.state || null,
      language: lang,
      finger_distance_cm: meta.fingerDistanceCm,
      screener_role: meta.role || null,
      device_label: typeof navigator !== "undefined" ? navigator.platform : null,
      confidence: analysis.confidence,
      snr_db: analysis.snrDb,
      perfusion_index: analysis.perfusionIndex,
      rmssd_ms: analysis.rmssdMs,
      ptt_spread_ms: analysis.pttSpreadMs,
      fps: analysis.fsActual,
      takes: analysis.takes,
    });
    setSaving(false);
    if (error) setSaveError(t("common.retryLater"));
    else setSaved(true);
  };

  return (
    <div className="panel p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {t("result.title")}
          </p>
          <h2 className={`mt-1 font-display text-3xl ${style.text}`}>{riskLabel}</h2>
        </div>
        <button
          onClick={speak}
          className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-secondary"
        >
          🔊 {t("result.speak")}
        </button>
      </div>

      {!analysis.ok && (
        <p className="mt-4 rounded-xl border border-risk-borderline/40 bg-risk-borderline/10 p-3 text-sm text-risk-borderline">
          {t("scan.weak")}
        </p>
      )}

      <div className={`mt-5 rounded-2xl border p-4 ${style.ring}`}>
        <div className="flex items-end justify-between">
          <span className="font-display text-5xl">{analysis.pwv.toFixed(2)}</span>
          <span className="text-sm text-muted-foreground">m/s · {t("result.pwv")}</span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-background/60">
          <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${gaugePct}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
          <span>4</span>
          <span>8</span>
          <span>10</span>
          <span>16 m/s</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          95% range {analysis.pwvLow.toFixed(2)}–{analysis.pwvHigh.toFixed(2)} m/s ·{" "}
          {analysis.takes > 1 ? `${analysis.takes} takes combined` : "single take"}
        </p>
        <p className="mt-3 text-sm">{advice}</p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Metric label={t("result.hr")} value={analysis.heartRate.toFixed(0)} unit="bpm" />
        <Metric label={t("result.ptt")} value={analysis.pttMs.toFixed(1)} unit="ms" />
        <Metric label={t("result.hrv")} value={analysis.hrvMs.toFixed(0)} unit="ms" />
        <Metric
          label={t("result.bp")}
          value={`${analysis.systolic}/${analysis.diastolic}`}
          unit="mmHg"
        />
        <Metric label={t("result.quality")} value={`${analysis.quality}`} unit="%" />
        <Metric label={t("result.beats")} value={`${analysis.beats}`} />
        <Metric label="Confidence" value={`${analysis.confidence}`} unit="%" />
        <Metric label="Signal SNR" value={analysis.snrDb.toFixed(1)} unit="dB" />
        <Metric label="Perfusion" value={analysis.perfusionIndex.toFixed(2)} unit="%" />
        <Metric label="RMSSD" value={analysis.rmssdMs.toFixed(0)} unit="ms" />
        <Metric label="PTT spread" value={`±${analysis.pttSpreadMs.toFixed(2)}`} unit="ms" />
        <Metric label="Camera rate" value={analysis.fsActual.toFixed(0)} unit="fps" />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
        <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
          PPG — red / green channel
        </p>
        <Waveform
          data={analysis.waveA.slice(0, 600)}
          secondary={analysis.waveB.slice(0, 600)}
          height={140}
        />
        </div>
        {analysis.template.length > 0 && (
          <div className="w-full sm:w-40">
            <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
              Averaged beat
            </p>
            <Waveform data={analysis.template} height={140} />
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={save}
          disabled={saving || saved}
          className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {saved ? `✓ ${t("result.saved")}` : t("result.save")}
        </button>
        <button
          onClick={onNewScan}
          className="rounded-xl border border-border px-5 py-3 text-sm font-medium hover:bg-secondary"
        >
          {t("result.new")}
        </button>
      </div>
      {saveError && <p className="mt-3 text-sm text-destructive">{saveError}</p>}

      <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
        {t("result.disclaimer")}
      </p>
    </div>
  );
}
