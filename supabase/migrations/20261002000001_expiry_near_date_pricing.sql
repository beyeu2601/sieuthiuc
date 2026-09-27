-- Gia can date theo phan loai san pham:
--   date ngan: con <= 15 ngay het han -> ap chuong trinh giam gia
--   date dai:  con <= 60 ngay het han -> ap chuong trinh giam gia
-- Ca hai loai: gia ban de xuat = gia von lo + phu thu (mac dinh 50.000d).
-- Chi goi y / canh bao tren man Han su dung, khong tu ghi de gia ban chinh thuc.
-- sadmin chinh duoc nguong 15/60 va phu thu qua cau hinh.

-- 1. Phan loai date cho san pham
create type public.product_date_type as enum ('short', 'long');
alter table public.products
  add column date_type public.product_date_type not null default 'long';
comment on column public.products.date_type is
  'Phan loai can date: short = date ngan (nguong expiry.short_date_days), long = date dai (nguong expiry.long_date_days)';

-- 2. Cau hinh rule (sadmin chinh chung, admin chinh rieng cua hang)
insert into public.settings(key, store_id, value) values
  ('expiry.short_date_days', null, '15'),
  ('expiry.long_date_days', null, '60'),
  ('expiry.markup_vnd', null, '50000')
on conflict on constraint settings_key_store_uq do nothing;

-- 3. lot_expiry: nguong can date theo phan loai san pham, kem gia ban de xuat.
--    Doi kieu tra ve nen phai drop truoc khi tao lai.
drop function if exists public.lot_expiry(uuid, text, uuid);
create or replace function public.lot_expiry(p_store_id uuid, p_status text default null, p_product_id uuid default null)
returns table (lot_id uuid, product_id uuid, sku text, name text, unit text, goods_type public.goods_type,
  lot_no text, expiry_date date, qty_on_hand numeric, days_left integer, expiry_status text, unit_cost bigint,
  date_type public.product_date_type, near_days integer, suggested_price bigint)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_short integer := coalesce((public.get_setting('expiry.short_date_days', p_store_id))::text::integer, 15);
  v_long integer := coalesce((public.get_setting('expiry.long_date_days', p_store_id))::text::integer, 60);
  v_markup bigint := coalesce((public.get_setting('expiry.markup_vnd', p_store_id))::text::bigint, 50000);
  v_show_cost boolean := public.auth_role() in ('sadmin','admin','accountant');
  v_today date := public._today();
begin
  if not public.can_access_store(p_store_id) then
    perform public.raise_error('FORBIDDEN', 'Bạn không có quyền xem cửa hàng này');
  end if;
  return query
  with lot as (
    select l.id, p.id as pid, p.sku, p.name, p.unit, p.goods_type, l.lot_no, l.expiry_date,
           l.qty_on_hand, l.unit_cost, l.received_at, p.date_type,
           (case when p.date_type = 'short' then v_short else v_long end) as thr,
           (l.expiry_date - v_today)::integer as dleft
    from public.stock_lots l join public.products p on p.id = l.product_id
    where l.store_id = p_store_id and l.qty_on_hand > 0
      and (p_product_id is null or l.product_id = p_product_id)
  )
  select lot.id, lot.pid, lot.sku, lot.name, lot.unit, lot.goods_type, lot.lot_no, lot.expiry_date,
         lot.qty_on_hand, lot.dleft,
         case when lot.expiry_date is null then 'none'
              when lot.expiry_date < v_today then 'expired'
              when lot.dleft <= lot.thr then 'near'
              else 'normal' end,
         case when v_show_cost then lot.unit_cost end,
         lot.date_type,
         lot.thr,
         case when v_show_cost and lot.expiry_date is not null and lot.dleft between 0 and lot.thr
              then lot.unit_cost + v_markup end
  from lot
  where (p_status is null
         or (p_status = 'expired' and lot.expiry_date < v_today)
         or (p_status = 'near' and lot.expiry_date >= v_today and lot.dleft <= lot.thr))
  order by lot.expiry_date nulls last, lot.received_at;
end $$;

revoke execute on function public.lot_expiry(uuid, text, uuid) from public, anon;
grant execute on function public.lot_expiry(uuid, text, uuid) to authenticated;
