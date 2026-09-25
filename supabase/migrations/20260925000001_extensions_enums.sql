-- Sprint 0 - extensions, enums, helper triggers dung chung
-- Nguon: SPEC muc 6.1. Khac SPEC: app_role co 4 vai tro (sadmin, admin, accountant, staff)
-- theo quyet dinh cua khach 25/09/2026; movement_type bo sung 'opening' (ton dau ky khi import).

create extension if not exists pg_trgm with schema extensions;

create type public.app_role as enum ('sadmin','admin','accountant','staff');
create type public.goods_type as enum ('cont','air');
create type public.product_status as enum ('active','inactive');
create type public.pricing_method as enum ('manual','benefit');
create type public.expiry_level as enum ('none','product','lot');
create type public.barcode_type as enum ('ean','internal');
create type public.doc_status as enum ('draft','pending','confirmed','approved','rejected','cancelled');
create type public.payment_method as enum ('cash','transfer','other');
create type public.sale_channel as enum ('pos','shopee','facebook','other');
create type public.sale_status as enum ('draft','completed','cancelled','refunded','partially_refunded');
create type public.order_status as enum ('pending','shipped','delivered','cancelled','returned');
create type public.movement_type as enum ('opening','purchase','sale','sale_return','adjustment','writeoff','count','transfer_out','transfer_in','order_reserve','order_release');
create type public.adjustment_reason as enum ('count_diff','damaged','expired','lost','internal_use','gift','data_error','other');
create type public.debt_status as enum ('unpaid','partial','paid');
create type public.shift_status as enum ('open','closed','approved','flagged');
create type public.cash_kind as enum ('income','expense');
create type public.approval_status as enum ('pending','approved','rejected');
create type public.points_type as enum ('earn','redeem','refund_earn','refund_redeem','expire','manual');
create type public.cost_method as enum ('wavg','fifo');

-- updated_at tu dong
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
