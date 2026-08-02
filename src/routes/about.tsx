import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About NadiScan — vivo Ignite 2026 Submission" },
      {
        name: "description",
        content:
          "NadiScan is a zero-cost, offline-capable hypertension screener for India's Aspirational Districts, built for vivo Ignite 2026 under SDG 3 and SDG 10.",
      },
      { property: "og:title", content: "About NadiScan" },
      {
        property: "og:description",
        content:
          "Problem, methodology, scientific basis, impact and technology stack behind the NadiScan pulse wave velocity screener.",
      },
    ],
  }),
  component: About,
});

const STACK = [
  ["Frontend", "React 19, TanStack Start, Tailwind CSS v4"],
  ["Camera access", "HTML5 MediaDevices getUserMedia + torch constraint"],
  ["Signal processing", "Canvas ROI sampling, band-pass filter, cross-correlation"],
  ["Risk model", "PWV regression + arterial stiffness classifier, in-browser"],
  ["Offline support", "Service worker + PWA manifest"],
  ["Localisation", "5 Indian languages + Web Speech voice output"],
  ["Registry", "Anonymous cloud database for population analytics"],
];

const REFS = [
  "Laurent S. et al. (2010). Aortic stiffness is an independent predictor of all-cause and cardiovascular mortality in hypertensive patients. The Lancet.",
  "Williams B. et al. (2018). ESC/ESH Guidelines for the management of arterial hypertension. European Heart Journal.",
  "Tamura T. et al. (2018). Wearable Photoplethysmographic Sensors — Past and Present. IEEE Transactions on Biomedical Engineering.",
  "WHO SDG 3 Targets — Ensure healthy lives and promote well-being for all at all ages.",
  "Ministry of Health & Family Welfare, India — ASHA Worker Framework & Aspirational Districts Programme.",
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel mt-6 p-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-3 space-y-3 text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

function About() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <p className="text-xs uppercase tracking-widest text-accent">
        vivo Ignite 2026 · 4th Edition · SoftTech Innovations
      </p>
      <h1 className="mt-2 font-display text-4xl">
        NadiScan — Browser-Based Pulse Wave Velocity Hypertension Screener
      </h1>
      <p className="mt-3 text-muted-foreground">
        Submitted by Sedhu Rangan P · Theme: Advanced AI and Machine Learning Labs · SDG 3 &amp;
        SDG 10
      </p>

      <Section title="The problem">
        <p>
          Over 220 million Indian adults live with hypertension, and most remain undiagnosed. A
          sphygmomanometer costs ₹800–₹2,500, needs a clinic visit and trained hands. ASHA workers
          screening door-to-door in the 112 Aspirational Districts have no affordable, portable
          tool — so most rural patients only discover their hypertension after irreversible organ
          damage.
        </p>
      </Section>

      <Section title="Objectives">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Preliminary hypertension screening from any smartphone browser — no download, no
            hardware, no cost.
          </li>
          <li>Let ASHA workers screen whole villages from one shareable web link.</li>
          <li>Colour-coded arterial stiffness risk, spoken in regional Indian languages.</li>
          <li>Fully offline after first load via progressive web app technology.</li>
          <li>Close the hypertension diagnostic gap in Aspirational Districts.</li>
        </ul>
      </Section>

      <Section title="Scientific approach">
        <p>
          Pulse wave velocity is a clinically validated biomarker of arterial stiffness: stiffer
          arteries propagate pressure waves faster, correlating with elevated blood pressure.
          Photoplethysmography with smartphone cameras is a peer-reviewed optical technique for
          detecting volumetric blood changes, and cross-correlating two PPG channels to derive
          transit time is an established biomedical signal-processing method. NadiScan runs that
          pipeline in JavaScript inside the browser.
        </p>
      </Section>

      <Section title="Limitations">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Finger placement consistency affects accuracy — the animated tutorial reduces error.
          </li>
          <li>Bright ambient light adds optical noise; screen in moderate lighting.</li>
          <li>The output is a preliminary risk indicator, never a clinical diagnosis.</li>
          <li>A rear flashlight is required — present on 95%+ of phones made after 2015.</li>
        </ul>
      </Section>

      <Section title="Technology stack">
        <dl className="grid gap-3 sm:grid-cols-2">
          {STACK.map(([k, v]) => (
            <div key={k} className="rounded-xl border border-border bg-background/50 p-3">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">{k}</dt>
              <dd className="mt-1 text-sm text-foreground">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Bibliography">
        <ul className="list-disc space-y-2 pl-5">
          {REFS.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
