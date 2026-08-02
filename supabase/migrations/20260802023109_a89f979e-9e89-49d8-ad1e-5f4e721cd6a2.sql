CREATE TABLE public.scan_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  pwv NUMERIC(6,2) NOT NULL,
  ptt_ms NUMERIC(8,2) NOT NULL,
  heart_rate NUMERIC(6,2) NOT NULL,
  hrv_ms NUMERIC(8,2),
  signal_quality NUMERIC(5,2) NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('normal','borderline','high')),
  est_systolic NUMERIC(6,2),
  est_diastolic NUMERIC(6,2),
  age_band TEXT,
  gender TEXT,
  district TEXT,
  state TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  finger_distance_cm NUMERIC(5,2),
  device_label TEXT,
  screener_role TEXT
);

GRANT SELECT, INSERT ON public.scan_records TO anon;
GRANT SELECT, INSERT ON public.scan_records TO authenticated;
GRANT ALL ON public.scan_records TO service_role;

ALTER TABLE public.scan_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record an anonymous screening"
  ON public.scan_records FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Anyone can view anonymous screening records"
  ON public.scan_records FOR SELECT TO anon, authenticated USING (true);

CREATE INDEX scan_records_created_at_idx ON public.scan_records (created_at DESC);
CREATE INDEX scan_records_risk_idx ON public.scan_records (risk_level);