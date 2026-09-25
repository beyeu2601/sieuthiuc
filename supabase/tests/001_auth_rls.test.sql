-- Sprint 0: phan quyen, RLS, cau hinh, ma chung tu, import ton dau ky.
-- Chay trong transaction va rollback; khong de lai du lieu.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(27);

-- Du lieu thu
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 't_sadmin@sieuthiuc.local'),
  ('00000000-0000-0000-0000-0000000000a2', 't_admin@sieuthiuc.local'),
  ('00000000-0000-0000-0000-0000000000a3', 't_acc@sieuthiuc.local'),
  ('00000000-0000-0000-0000-0000000000a4', 't_staffa@sieuthiuc.local'),
  ('00000000-0000-0000-0000-0000000000a5', 't_staffb@sieuthiuc.local');

insert into stores (id, code, name) values
  ('00000000-0000-0000-0000-00000000000a', 'TA', 'Test A'),
  ('00000000-0000-0000-0000-00000000000b', 'TB', 'Test B');

insert into profiles (id, username, full_name, role) values
  ('00000000-0000-0000-0000-0000000000a1', 't_sadmin', 'T sadmin', 'sadmin'),
  ('00000000-0000-0000-0000-0000000000a2', 't_admin', 'T admin', 'admin'),
  ('00000000-0000-0000-0000-0000000000a3', 't_acc', 'T acc', 'accountant'),
  ('00000000-0000-0000-0000-0000000000a4', 't_staffa', 'T staff A', 'staff'),
  ('00000000-0000-0000-0000-0000000000a5', 't_staffb', 'T staff B', 'staff');

insert into user_stores (user_id, store_id) values
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-00000000000b');

create schema tests;
create function tests.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;
create function tests.logout() returns void language sql as $$
  select set_config('role', 'postgres', true);
  select set_config('request.jwt.claims', '', true);
$$;
grant usage on schema tests to authenticated;
grant execute on all functions in schema tests to authenticated;

-- 1. Vai tro va pham vi cua hang
select tests.login('00000000-0000-0000-0000-0000000000a1');
select is(auth_role(), 'sadmin'::app_role, 'sadmin: auth_role dung');
select is((select count(*) from stores where code in ('TA','TB')), 2::bigint, 'sadmin thay moi cua hang');

select tests.login('00000000-0000-0000-0000-0000000000a4');
select is(auth_role(), 'staff'::app_role, 'staff: auth_role dung');
select is((select count(*) from stores where code in ('TA','TB')), 1::bigint, 'staff A chi thay cua hang A');
select ok(can_access_store('00000000-0000-0000-0000-00000000000a'), 'staff A vao duoc cua hang A');
select ok(not can_access_store('00000000-0000-0000-0000-00000000000b'), 'staff A khong vao duoc cua hang B');
select ok(not is_store_manager('00000000-0000-0000-0000-00000000000a'), 'staff khong phai quan ly cua hang');

select tests.login('00000000-0000-0000-0000-0000000000a2');
select ok(is_store_manager('00000000-0000-0000-0000-00000000000a'), 'admin la quan ly cua hang A');
select ok(not is_store_manager('00000000-0000-0000-0000-00000000000b'), 'admin khong quan ly cua hang B');
select is((select count(*) from profiles where username like 't\_%'), 3::bigint,
  'admin A thay ban than + nguoi cung cua hang A (khong thay sadmin, staff B)');

-- 2. Nguoi chua dang nhap / khong co ho so
select tests.login('00000000-0000-0000-0000-0000000000ff');
select is(auth_role(), null::app_role, 'user khong co ho so: khong co vai tro');
select is((select count(*) from stores where code in ('TA','TB')), 0::bigint, 'user khong co ho so khong thay cua hang');

-- 3. Ghi san pham
select tests.login('00000000-0000-0000-0000-0000000000a4');
select throws_ok(
  $$ insert into products (name, unit, goods_type) values ('SP staff', 'Hộp', 'cont') $$,
  '42501', null, 'staff khong tao duoc san pham');

select tests.login('00000000-0000-0000-0000-0000000000a2');
select lives_ok(
  $$ insert into products (id, name, unit, goods_type, sell_price)
     values ('00000000-0000-0000-0000-0000000000c1', 'SP test', 'Hộp', 'cont', 100000) $$,
  'admin tao duoc san pham');
select matches((select sku from products where id = '00000000-0000-0000-0000-0000000000c1'),
  '^SP-[0-9]{6}$', 'SKU tu sinh dang SP-000001');
update products set sell_price = 120000 where id = '00000000-0000-0000-0000-0000000000c1';
select is((select new_value from price_history
           where product_id = '00000000-0000-0000-0000-0000000000c1' and field = 'sell_price'),
  '120000', 'doi gia ban ghi price_history');

-- 4. Cau hinh
select tests.login('00000000-0000-0000-0000-0000000000a2');
select throws_ok(
  $$ select set_setting('pos.max_manual_discount_pct', null, '20') $$,
  'P0001', null, 'admin khong sua duoc cau hinh chung');
select lives_ok(
  $$ select set_setting('pos.max_manual_discount_pct', '00000000-0000-0000-0000-00000000000a', '15') $$,
  'admin sua duoc cau hinh rieng cua hang A');
select throws_ok(
  $$ select set_setting('pos.max_manual_discount_pct', '00000000-0000-0000-0000-00000000000b', '15') $$,
  'P0001', null, 'admin khong sua duoc cau hinh cua hang B');
select is(get_setting('pos.max_manual_discount_pct', '00000000-0000-0000-0000-00000000000a'), '15'::jsonb,
  'get_setting uu tien gia tri cua cua hang');
select is(get_setting('pos.max_manual_discount_pct', '00000000-0000-0000-0000-00000000000b'), '10'::jsonb,
  'get_setting lay gia tri chung khi cua hang khong ghi de');

-- 5. Ma chung tu
select tests.logout();
select matches(next_doc_code('PN', 'TA'), '^PN-TA-[0-9]{6}-0001$', 'ma chung tu dau tien trong ngay');
select matches(next_doc_code('PN', 'TA'), '^PN-TA-[0-9]{6}-0002$', 'ma chung tu tang dan');

-- 6. Import ton dau ky
select tests.login('00000000-0000-0000-0000-0000000000a4');
select throws_ok(
  $$ select import_opening_stock('00000000-0000-0000-0000-00000000000a',
       '[{"name":"X","unit":"Hộp","goods_type":"air","sell_price":1,"cost":1,"qty":1}]') $$,
  'P0001', null, 'staff khong import duoc ton dau ky');

select tests.login('00000000-0000-0000-0000-0000000000a1');
select is((import_opening_stock('00000000-0000-0000-0000-00000000000a',
  '[{"name":"Sua A","unit":"Lon","goods_type":"cont","sell_price":900000,"cost":760000,"qty":83},
    {"name":"Sua B","unit":"Lon","goods_type":"air","sell_price":900000,"cost":700000,"qty":0}]'
  ) ->> 'products'), '2', 'sadmin import 2 san pham');
select is((select sum(i.qty_on_hand) from inventory i where i.store_id = '00000000-0000-0000-0000-00000000000a'),
  83::numeric, 'ton sau import = tong so luong import va = tong bien dong');
select throws_ok(
  $$ select import_opening_stock('00000000-0000-0000-0000-00000000000a',
       '[{"name":"Y","unit":"Hộp","goods_type":"air","sell_price":1,"cost":1,"qty":1}]') $$,
  'P0001', null, 'import lan 2 bi chan');

select * from finish();
rollback;
