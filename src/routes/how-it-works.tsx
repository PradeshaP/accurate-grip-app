import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import demoVideo from "@/assets/finger-placement-demo.mp4.asset.json";
import heroImage from "@/assets/hero-scan.jpg";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How NadiScan Works — Finger Placement & PPG Method" },
      {
        name: "description",
        content:
          "Watch the finger placement demo and see how NadiScan turns camera light into a PPG waveform, a pulse transit time and a pulse wave velocity risk score.",
      },
      { property: "og:title", content: "How NadiScan Works" },
      {
        property: "og:description",
        content:
          "Dual finger placement, PPG capture, waveform extraction, pulse transit time and on-device risk classification explained.",
      },
    ],
  }),
  component: HowItWorks,
});

const STEPS = [
  {
    n: "01",
    title: "Dual finger placement",
    body: "Place your index and middle finger flat over the rear camera lens and the flashlight. Cover both completely, press gently — no squeezing.",
  },
  {
    n: "02",
    title: "PPG signal capture",
    body: "The flashlight shines through the tissue and the camera records light transmission at 30 fps for 30 seconds using the MediaDevices API.",
  },
  {
    n: "03",
    title: "Waveform extraction",
    body: "Each frame's red and green channel means are averaged over a central region of interest, then band-pass filtered to 0.7–3.5 Hz to isolate the cardiac pulse.",
  },
  {
    n: "04",
    title: "Pulse transit time",
    body: "Time-domain cross-correlation with sub-sample parabolic refinement measures the delay between the two channels. Divided into the finger separation, that gives pulse wave velocity.",
  },
  {
    n: "05",
    title: "Risk classification",
    body: "PWV is mapped to arterial stiffness bands — green under 8 m/s, yellow 8–10 m/s, red above 10 m/s — entirely in browser memory. Nothing is uploaded unless you save it.",
  },
];

const TIPS = [
  "Screen indoors in moderate light — avoid direct sunlight on the lens.",
  "Rest for two minutes before scanning and stay seated.",
  "Keep the hand supported on a table so the fingers do not shift.",
  "Cold fingers reduce perfusion — warm them briefly if the signal is weak.",
];

function HowItWorks() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="font-display text-4xl">How the screening works</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        NadiScan applies photoplethysmography and pulse wave velocity — both clinically
        validated biomarkers — using nothing but a smartphone camera and its LED.
      </p>

      <section className="panel mt-8 overflow-hidden">
        <video
          src={demoVideo.url}
          poster={heroImage}
          controls
          playsInline
          muted
          loop
          autoPlay
          className="aspect-video w-full bg-background object-cover"
        />
        <div className="p-5">
          <h2 className="text-lg font-semibold">Demo: how to place your hand</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Two fingers flat across the rear camera and flashlight. The fingertips glow red —
            that glow is the signal being measured.
          </p>
        </div>
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        {STEPS.map((s) => (
          <article key={s.n} className="panel p-5">
            <span className="font-display text-sm text-accent">{s.n}</span>
            <h3 className="mt-1 text-lg font-semibold">{s.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
          </article>
        ))}
        <article className="panel p-5">
          <span className="font-display text-sm text-accent">TIPS</span>
          <h3 className="mt-1 text-lg font-semibold">For an accurate reading</h3>
          <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
            {TIPS.map((tip) => (
              <li key={tip} className="flex gap-2">
                <span className="text-primary">·</span>
                {tip}
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="panel mt-10 p-6">
        <h2 className="text-xl font-semibold">Reading the result</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            ["Green", "< 8 m/s", "Normal arterial stiffness", "risk-normal"],
            ["Yellow", "8 – 10 m/s", "Borderline — recheck in 4 weeks", "risk-borderline"],
            ["Red", "> 10 m/s", "High — see a doctor or PHC", "risk-high"],
          ].map(([band, range, label, token]) => (
            <div key={band} className={`rounded-xl border border-${token}/40 bg-${token}/10 p-4`}>
              <p className={`font-display text-lg text-${token}`}>{band}</p>
              <p className="mt-1 text-sm">{range}</p>
              <p className="mt-1 text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
        >
          Start a scan
        </Link>
      </section>
    </div>
  );
}
