import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import heroImage from "@/assets/hero-scan.jpg";
import { Scanner } from "@/components/scanner";
import { ResultCard } from "@/components/result-card";
import { useI18n } from "@/lib/i18n";
import type { ScanAnalysis } from "@/lib/ppg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NadiScan — Smartphone Pulse Wave Hypertension Screener" },
      {
        name: "description",
        content:
          "Free browser-based hypertension screening. Measure pulse wave velocity with your phone camera and flashlight — no cuff, no app install, no data upload.",
      },
      { property: "og:title", content: "NadiScan — Smartphone Hypertension Screener" },
      {
        property: "og:description",
        content:
          "Measure arterial stiffness from your fingertip using only a smartphone camera. Works offline, in five Indian languages.",
      },
    ],
  }),
  component: Index,
});

const AGE_BANDS = ["18-29", "30-39", "40-49", "50-59", "60+"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function Index() {
  const { t } = useI18n();
  const [result, setResult] = useState<ScanAnalysis | null>(null);
  const [meta, setMeta] = useState({
    ageBand: "",
    gender: "",
    district: "",
    state: "",
    role: "self",
    fingerDistanceCm: 3,
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <section className="grid items-center gap-8 lg:grid-cols-2">
        <div>
          <span className="inline-flex rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs text-primary">
            {t("hero.tag")}
          </span>
          <h1 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">
            <span className="text-gradient">{t("hero.title")}</span>
          </h1>
          <p className="mt-4 max-w-xl text-muted-foreground">{t("hero.sub")}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="#scan"
              className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow"
            >
              {t("hero.cta")}
            </a>
            <Link
              to="/how-it-works"
              className="rounded-xl border border-border px-5 py-3 text-sm font-medium hover:bg-secondary"
            >
              {t("hero.secondary")}
            </Link>
          </div>
          <dl className="mt-8 grid grid-cols-3 gap-3 text-center">
            {[
              ["₹0", "hardware cost"],
              ["30 s", "per screening"],
              ["100%", "on-device"],
            ].map(([v, l]) => (
              <div key={l} className="rounded-xl border border-border bg-surface/60 p-3">
                <dt className="font-display text-2xl text-primary">{v}</dt>
                <dd className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                  {l}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <img
          src={heroImage}
          alt="Two fingertips pressed over a smartphone rear camera and flashlight with a glowing pulse waveform"
          width={1600}
          height={1008}
          className="rounded-3xl border border-border object-cover shadow-glow"
        />
      </section>

      <section id="scan" className="mt-12 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        {result ? (
          <ResultCard analysis={result} meta={meta} onNewScan={() => setResult(null)} />
        ) : (
          <Scanner fingerDistanceCm={meta.fingerDistanceCm} onResult={setResult} />
        )}

        <div className="panel h-fit p-5 sm:p-7">
          <h2 className="text-lg font-semibold">{t("form.title")}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label={t("form.age")}>
              <select
                className={inputClass}
                value={meta.ageBand}
                onChange={(e) => setMeta({ ...meta, ageBand: e.target.value })}
              >
                <option value="">—</option>
                {AGE_BANDS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("form.gender")}>
              <select
                className={inputClass}
                value={meta.gender}
                onChange={(e) => setMeta({ ...meta, gender: e.target.value })}
              >
                <option value="">—</option>
                <option value="male">{t("form.male")}</option>
                <option value="female">{t("form.female")}</option>
                <option value="other">{t("form.other")}</option>
              </select>
            </Field>
            <Field label={t("form.district")}>
              <input
                className={inputClass}
                value={meta.district}
                onChange={(e) => setMeta({ ...meta, district: e.target.value })}
                placeholder="e.g. Ramanathapuram"
              />
            </Field>
            <Field label={t("form.state")}>
              <input
                className={inputClass}
                value={meta.state}
                onChange={(e) => setMeta({ ...meta, state: e.target.value })}
                placeholder="e.g. Tamil Nadu"
              />
            </Field>
            <Field label={t("form.role")}>
              <select
                className={inputClass}
                value={meta.role}
                onChange={(e) => setMeta({ ...meta, role: e.target.value })}
              >
                <option value="self">{t("form.self")}</option>
                <option value="asha">{t("form.asha")}</option>
                <option value="phc">{t("form.phc")}</option>
              </select>
            </Field>
            <Field label={t("form.distance")}>
              <input
                type="number"
                min={1}
                max={12}
                step={0.5}
                className={inputClass}
                value={meta.fingerDistanceCm}
                onChange={(e) =>
                  setMeta({ ...meta, fingerDistanceCm: Number(e.target.value) || 3 })
                }
              />
            </Field>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            No name, phone number or face is ever recorded. Only anonymous measurements are
            stored, and only when you tap save.
          </p>
        </div>
      </section>
    </div>
  );
}
