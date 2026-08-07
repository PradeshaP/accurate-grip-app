ALTER TABLE public.scan_records
  ADD COLUMN IF NOT EXISTS confidence numeric,
  ADD COLUMN IF NOT EXISTS snr_db numeric,
  ADD COLUMN IF NOT EXISTS perfusion_index numeric,
  ADD COLUMN IF NOT EXISTS rmssd_ms numeric,
  ADD COLUMN IF NOT EXISTS ptt_spread_ms numeric,
  ADD COLUMN IF NOT EXISTS fps numeric,
  ADD COLUMN IF NOT EXISTS takes integer;