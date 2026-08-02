import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RiskLevel } from "@/lib/ppg";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Screening Analytics — NadiScan Community Registry" },
      {
        name: "description",
        content:
          "Anonymous population dashboard of NadiScan screenings: risk distribution, average pulse wave velocity, district coverage and recent readings.",
      },
      { property: "og:title", content: "NadiScan Screening Analytics" },
      {
        property: "og:description",
        content:
          "Population-level hypertension risk mapping built from anonymous smartphone pulse wave screenings.",
      },
    ],
  }),
  component: Analytics,
});

interface Row {
  id: string;
  created_at: string;
  pwv: number;
  heart_rate: number;
  ptt_ms: number;
  signal_quality: number;
  risk_level: RiskLevel;
  est_systolic: number | null;
  est_diastolic: number | null;
  age_band: string | null;
  gender: string | null;
  district: string | null;
  state: string | null;
  screener_role: string | null;
}

const RISK_META: Record<RiskLevel, { label: string; bar: string; text: string }> = {
  normal: { label: "Normal", bar: "bg-risk-normal", text: "text-risk-normal" },
  borderline: { label: "Borderline", bar: "bg-risk-borderline", text: "text-risk-borderline" },
  high: { label: "High risk", bar: "bg-risk-high", text: "text-risk-high" },
};

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="panel p-5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Analytics() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["scan-records"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scan_records")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const rows = data ?? [];
  const total = rows.length;
  const counts: Record<RiskLevel, number> = { normal: 0, borderline: 0, high: 0 };
  for (const r of rows) counts[r.risk_level] = (counts[r.risk_level] ?? 0) + 1;
  const avg = (fn: (r: Row) => number) =>
    total ? rows.reduce((s, r) => s + fn(r), 0) / total : 0;

  const districts = new Map<string, { n: number; high: number }>();
  for (const r of rows) {
    const key = r.district?.trim() || "Unspecified";
    const entry = districts.get(key) ?? { n: 0, high: 0 };
    entry.n += 1;
    if (r.risk_level === "high") entry.high += 1;
    districts.set(key, entry);
  }
  const topDistricts = [...districts.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 6);

  const ageBands = new Map<string, number[]>();
  for (const r of rows) {
    if (!r.age_band) continue;
    ageBands.set(r.age_band, [...(ageBands.get(r.age_band) ?? []), r.pwv]);
  }
  const ageRows = [...ageBands.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <h1 className="font-display text-4xl">Community screening analytics</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Every saved screening is stored without any identifying information, so health teams can
        map cardiovascular risk across districts.
      </p>

      {isLoading && <p className="mt-8 text-sm text-muted-foreground">Loading registry…</p>}
      {error && <p className="mt-8 text-sm text-destructive">Could not load the registry.</p>}

      {!isLoading && !error && (
        <>
          <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Screenings recorded" value={String(total)} />
            <Stat
              label="Average PWV"
              value={total ? `${avg((r) => Number(r.pwv)).toFixed(2)} m/s` : "—"}
              sub="Arterial stiffness marker"
            />
            <Stat
              label="Average heart rate"
              value={total ? `${avg((r) => Number(r.heart_rate)).toFixed(0)} bpm` : "—"}
            />
            <Stat
              label="Flagged high risk"
              value={total ? `${Math.round((counts.high / total) * 100)}%` : "—"}
              sub="Referred for clinical confirmation"
            />
          </section>

          <section className="panel mt-6 p-6">
            <h2 className="text-lg font-semibold">Risk distribution</h2>
            <div className="mt-4 space-y-3">
              {(Object.keys(RISK_META) as RiskLevel[]).map((level) => {
                const pct = total ? (counts[level] / total) * 100 : 0;
                const meta = RISK_META[level];
                return (
                  <div key={level}>
                    <div className="flex justify-between text-sm">
                      <span className={meta.text}>{meta.label}</span>
                      <span className="text-muted-foreground">
                        {counts[level]} · {pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-secondary">
                      <div className={`h-full rounded-full ${meta.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="panel p-6">
              <h2 className="text-lg font-semibold">Top districts screened</h2>
              {topDistricts.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No screenings saved yet.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {topDistricts.map(([name, d]) => (
                    <li key={name}>
                      <div className="flex justify-between text-sm">
                        <span>{name}</span>
                        <span className="text-muted-foreground">
                          {d.n} scans · {d.high} high risk
                        </span>
                      </div>
                      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${(d.n / (topDistricts[0]?.[1].n || 1)) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="panel p-6">
              <h2 className="text-lg font-semibold">Average PWV by age band</h2>
              {ageRows.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No age data recorded yet.</p>
              ) : (
                <div className="mt-5 flex h-48 items-end gap-3">
                  {ageRows.map(([band, values]) => {
                    const mean = values.reduce((s, v) => s + Number(v), 0) / values.length;
                    const h = Math.min(100, (mean / 16) * 100);
                    return (
                      <div key={band} className="flex flex-1 flex-col items-center gap-2">
                        <span className="text-xs text-muted-foreground">{mean.toFixed(1)}</span>
                        <div
                          className="w-full rounded-t-lg bg-accent"
                          style={{ height: `${h}%` }}
                        />
                        <span className="text-xs text-muted-foreground">{band}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <section className="panel mt-6 overflow-x-auto p-6">
            <h2 className="text-lg font-semibold">Recent screenings</h2>
            <table className="mt-4 w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-2">Date</th>
                  <th className="pb-2">PWV</th>
                  <th className="pb-2">HR</th>
                  <th className="pb-2">Est. BP</th>
                  <th className="pb-2">Quality</th>
                  <th className="pb-2">Risk</th>
                  <th className="pb-2">District</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 15).map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="py-2">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className="py-2">{Number(r.pwv).toFixed(2)}</td>
                    <td className="py-2">{Number(r.heart_rate).toFixed(0)}</td>
                    <td className="py-2">
                      {r.est_systolic ? `${r.est_systolic}/${r.est_diastolic}` : "—"}
                    </td>
                    <td className="py-2">{Number(r.signal_quality).toFixed(0)}%</td>
                    <td className={`py-2 ${RISK_META[r.risk_level].text}`}>
                      {RISK_META[r.risk_level].label}
                    </td>
                    <td className="py-2">{r.district || "—"}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-4 text-muted-foreground">
                      No screenings saved yet — run a scan and tap save.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
