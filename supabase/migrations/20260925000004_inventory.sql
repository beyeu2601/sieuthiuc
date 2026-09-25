-- Sprint 0 - ton kho, lo, bien dong ton; import ton dau ky
-- Nguon: SPEC muc 6.6, 7.1, 7.2.
-- Phieu dieu chinh, kiem ke, chuyen kho se tao o Sprint 2 (P0 chuyen kho) va Phase 2 (P1).

create table public.inventory (
  store_id uuid not null references public.stores(id),
  product_id uuid not null references public.products(id),
  qty_on_hand numeric(12,3) not null default 0 check (qty_on_hand >= 0),
  qty_reserved numeric(12,3) not null default 0 check (qty_reserved >= 0),
  qty_available numeric(12,3) generated always as (qty_on_hand - qty_reserved) stored,
  avg_cost bigint not null default 0 check (avg_cost >= 0),
  updated_at timestamptz not null default now(),
  primary key (store_id, product_id)
);
create index inventory_product_idx on public.inventory(product_id);

create table public.stock_lots (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  product_id uuid not null references public.products(id),
  lot_no text not null,
  expiry_date date,
  qty_on_hand numeric(12,3) not null default 0 check (qty_on_hand >= 0),
  unit_cost bigint not null default 0 check (unit_cost >= 0),
  receipt_item_id uuid,
  received_at timestamptz not null default now(),
  unique (store_id, product_id, lot_no)
);
create index stock_lots_fefo_idx on public.stock_lots(store_id, product_id, expiry_date);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  product_id uuid not null references public.products(id),
  lot_id uuid references public.stock_lots(id),
  movement_type public.movement_type not null,
  qty_delta numeric(12,3) not null,
  qty_before numeric(12,3) not null,
  qty_after numeric(12,3) not null,
  unit_cost bigint not null default 0,
  ref_type text,
  ref_id uuid,
  note text,
  performed_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index stock_movements_store_created_idx on public.stock_movements(store_id, created_at);
create index stock_movements_product_idx on public.stock_movements(product_id);

-- RLS: chi doc theo cua hang; moi thay doi ton di qua RPC
alter table public.inventory enable row level security;
alter table public.stock_lots enable row level security;
alter table public.stock_movements enable row level security;

create policy inventory_select on public.inventory for select to authenticated
  using ((select public.can_access_store(store_id)));
create policy stock_lots_select on public.stock_lots for select to authenticated
  using ((select public.can_access_store(store_id)));
create policy stock_movements_select on public.stock_movements for select to authenticated
  using ((select public.can_access_store(store_id)));

------------------------------------------------------------
-- Import ton dau ky (chay 1 lan cho moi cua hang, chi sadmin)
-- p_items: [{name, unit, goods_type, sell_price, cost, qty, note}]
------------------------------------------------------------
create or replace function public.import_opening_stock(p_store_id uuid, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  it jsonb;
  v_product_id uuid;
  v_lot_id uuid;
  v_qty numeric(12,3);
  v_cost bigint;
  v_count integer := 0;
  v_total numeric := 0;
begin
  perform public.assert_role('sadmin');

  if not exists (select 1 from public.stores where id = p_store_id) then
    perform public.raise_error('NOT_FOUND', 'Không tìm thấy cửa hàng');
  end if;
  if exists (select 1 from public.stock_movements
             where store_id = p_store_id and movement_type = 'opening') then
    perform public.raise_error('ALREADY_CONFIRMED', 'Cửa hàng này đã import tồn đầu kỳ');
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    perform public.raise_error('VALIDATION', 'Danh sách sản phẩm rỗng');
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    v_qty  := coalesce((it ->> 'qty')::numeric, 0);
    v_cost := coalesce((it ->> 'cost')::bigint, 0);
    if v_qty < 0 or v_cost < 0 then
      perform public.raise_error('VALIDATION', 'Số lượng hoặc giá vốn âm: ' || (it ->> 'name'));
    end if;

    insert into public.products(name, unit, goods_type, sell_price, cost_price_ref, note)
    values (trim(it ->> 'name'), trim(it ->> 'unit'), (it ->> 'goods_type')::public.goods_type,
            coalesce((it ->> 'sell_price')::bigint, 0), v_cost, nullif(trim(it ->> 'note'), ''))
    returning id into v_product_id;

    insert into public.inventory(store_id, product_id, qty_on_hand, avg_cost)
    values (p_store_id, v_product_id, v_qty, v_cost);

    if v_qty > 0 then
      insert into public.stock_lots(store_id, product_id, lot_no, qty_on_hand, unit_cost)
      values (p_store_id, v_product_id, 'TONDAU', v_qty, v_cost)
      returning id into v_lot_id;

      insert into public.stock_movements(store_id, product_id, lot_id, movement_type,
        qty_delta, qty_before, qty_after, unit_cost, ref_type, note)
      values (p_store_id, v_product_id, v_lot_id, 'opening',
        v_qty, 0, v_qty, v_cost, 'opening_import', 'Tồn đầu kỳ khi khởi tạo hệ thống');
    end if;

    v_count := v_count + 1;
    v_total := v_total + v_qty;
  end loop;

  insert into public.audit_logs(user_id, action, entity, store_id, after)
  values (auth.uid(), 'inventory.import_opening', 'inventory', p_store_id,
          jsonb_build_object('products', v_count, 'total_qty', v_total));

  return jsonb_build_object('products', v_count, 'total_qty', v_total);
end $$;

revoke execute on function public.import_opening_stock(uuid, jsonb) from public, anon;
grant execute on function public.import_opening_stock(uuid, jsonb) to authenticated;

------------------------------------------------------------
-- Tong quan ton kho cua 1 cua hang (doc qua RLS cua nguoi goi)
-- Gia tri ton chi tra ve cho sadmin, admin, accountant.
------------------------------------------------------------
create or replace function public.store_overview(p_store_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'active_products', (select count(*) from public.products p where p.status = 'active'),
    'skus_in_stock', count(*) filter (where i.qty_on_hand > 0),
    'total_qty', coalesce(sum(i.qty_on_hand), 0),
    'stock_value', case when public.auth_role() in ('sadmin','admin','accountant')
                        then coalesce(sum(i.qty_on_hand * i.avg_cost), 0) end
  )
  from public.inventory i
  where i.store_id = p_store_id
$$;

revoke execute on function public.store_overview(uuid) from public, anon;
grant execute on function public.store_overview(uuid) to authenticated;
