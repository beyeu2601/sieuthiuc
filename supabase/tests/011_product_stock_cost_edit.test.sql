-- Chinh truc tiep ton kho va gia von (adjust_product_stock).
begin;
-- @include setup.sql

select plan(14);

insert into products (id, name, unit, goods_type, expiry_level) values
  ('00000000-0000-0000-0000-0000000000e1', 'Hàng chỉnh tồn', 'Hộp', 'air', 'lot'),
  ('00000000-0000-0000-0000-0000000000e2', 'Hàng chưa có giá vốn', 'Hộp', 'air', 'none');

select tests.login(tests.uid('admin'));

-- San pham moi: chi nhap ton, chua co gia von
select lives_ok($$ select adjust_product_stock(tests.store('A'), '00000000-0000-0000-0000-0000000000e2', 5, null) $$,
  'nhap ton khi chua co gia von');
select is((select qty_on_hand from inventory where store_id = tests.store('A') and product_id = '00000000-0000-0000-0000-0000000000e2'),
  5::numeric, 'ton = 5, gia von de sau');

-- Tang ton tu 0 len 10 kem gia von 40000 va HSD
select adjust_product_stock(tests.store('A'), '00000000-0000-0000-0000-0000000000e1', 10, 40000, '2027-01-31', 'Hàng về');
select is((select qty_on_hand from inventory where store_id = tests.store('A') and product_id = '00000000-0000-0000-0000-0000000000e1'),
  10::numeric, 'tang ton: 10');
select is((select avg_cost from inventory where store_id = tests.store('A') and product_id = '00000000-0000-0000-0000-0000000000e1'),
  40000::bigint, 'gia von binh quan = 40000');
select is((select cost_price_ref from products where id = '00000000-0000-0000-0000-0000000000e1'),
  40000::bigint, 'gia von tham chieu = 40000');
select is((select expiry_date from stock_lots where product_id = '00000000-0000-0000-0000-0000000000e1'),
  '2027-01-31'::date, 'lo moi co HSD');
select is((select note from stock_movements where product_id = '00000000-0000-0000-0000-0000000000e1' and movement_type = 'adjustment'),
  'Hàng về', 'bien dong dieu chinh ghi chu');

-- Chi doi gia von: lo con hang cung doi
select adjust_product_stock(tests.store('A'), '00000000-0000-0000-0000-0000000000e1', 10, 45000);
select is((select unit_cost from stock_lots where product_id = '00000000-0000-0000-0000-0000000000e1'),
  45000::bigint, 'gia von lo = 45000');
select is((select count(*) from stock_movements where product_id = '00000000-0000-0000-0000-0000000000e1'),
  1::bigint, 'chi doi gia von khong tao bien dong');

-- Giam ton 10 -> 4
select adjust_product_stock(tests.store('A'), '00000000-0000-0000-0000-0000000000e1', 4, 45000);
select is((select qty_on_hand from inventory where store_id = tests.store('A') and product_id = '00000000-0000-0000-0000-0000000000e1'),
  4::numeric, 'giam ton: 4');
select is((select sum(qty_on_hand) from stock_lots where product_id = '00000000-0000-0000-0000-0000000000e1'),
  4::numeric, 'ton lo khop ton tong');

select throws_ok($$ select adjust_product_stock(tests.store('A'), '00000000-0000-0000-0000-0000000000e1', -1, null) $$,
  'P0001', null, 'tu choi ton am');

-- Phan quyen
select tests.login(tests.uid('acc'));
select throws_ok($$ select adjust_product_stock(tests.store('A'), '00000000-0000-0000-0000-0000000000e1', 8, null) $$,
  'P0001', null, 'ke toan khong duoc chinh');
select tests.login(tests.uid('staff'));
select throws_ok($$ select adjust_product_stock(tests.store('A'), '00000000-0000-0000-0000-0000000000e1', 8, null) $$,
  'P0001', null, 'nhan vien khong duoc chinh');

select * from finish();
rollback;
