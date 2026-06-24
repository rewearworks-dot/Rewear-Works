-- ============================================================================
-- v2_0011 — penanda tinjauan manual untuk pembayaran "nyasar"
-- ----------------------------------------------------------------------------
-- Saat pembayaran masuk untuk order yang sudah Dibatalkan/expired, kita tidak
-- boleh menandainya 'paid' (stok mungkin sudah dilepas/terjual lagi). Tandai
-- needs_review = true untuk refund/tinjauan manual TANPA melanggar CHECK
-- payment_status ('unpaid'|'paid'|'failed'|'expired').
-- Idempoten. Jalankan setelah v2_0010.
-- ============================================================================

alter table public.orders
  add column if not exists needs_review boolean not null default false;

comment on column public.orders.needs_review is
  'true bila pembayaran masuk untuk order batal/expired — perlu refund/tinjauan manual';
