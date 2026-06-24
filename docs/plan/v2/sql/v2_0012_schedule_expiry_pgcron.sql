-- ============================================================================
-- v2_0012 — Jadwalkan auto-expiry via Supabase pg_cron (DISARANKAN)
-- ----------------------------------------------------------------------------
-- KENAPA: jadwal cron Vercel "*/15 * * * *" hanya berjalan tiap 15 menit di plan
-- Pro. Di Vercel Hobby/Free, cron dibatasi (~sekali sehari), sehingga pelepasan
-- stok order belum-dibayar praktis tidak jalan. pg_cron Supabase TIDAK kena
-- batasan itu → jadikan ini mekanisme UTAMA; route /api/cron/expire jadi cadangan.
--
-- Jalankan SETELAH v2_0010 (yang membuat fungsi expire_unpaid_orders()).
-- Idempoten: aman dijalankan ulang.
-- ============================================================================

-- 1) Aktifkan extension pg_cron (sekali per project).
create extension if not exists pg_cron;

-- 2) Hapus jadwal lama bila ada (agar idempoten), lalu buat ulang tiap 15 menit.
do $$
begin
  perform cron.unschedule('expire-unpaid-orders')
  where exists (select 1 from cron.job where jobname = 'expire-unpaid-orders');
end;
$$;

select cron.schedule(
  'expire-unpaid-orders',
  '*/15 * * * *',
  $$ select public.expire_unpaid_orders(); $$
);

-- 3) Verifikasi:
--   select jobid, jobname, schedule, active from cron.job where jobname = 'expire-unpaid-orders';
--   -- Cek riwayat eksekusi:
--   select * from cron.job_run_details order by start_time desc limit 5;
