-- Sua don da giao: doi san pham va so luong, tra hang ve lo cu, xuat lai FEFO, cap nhat gia von va tien.
begin;
-- @include setup.sql

select plan(12);

insert into suppliers (id, name, payment_terms_days) values ('00000000-0000-0000-0000-0000000000e1', 'NCC Test', 0);
insert into products (id, name, unit, goods_type, sell_price, expiry_level) values
  ('00000000-0000-0000-0000-0000000000c1', 'Bánh A', 'Gói', 'air', 100000, 'none'),
  ('00000000-0000-0000-0000-0000000000c2', 'Kẹo B', 'Gói', 'air', 50000, 'none');

select tests.login(tests.uid('admin'));
select confirm_purchase_receipt((save_purchase_receipt('{"store_id":"00000000-0000-0000-0000-00000000000a",
  "supplier_id":"00000000-0000-0000-0000-0000000000e1","receipt_date":"2026-09-01",
  "items":[{"product_id":"00000000-0000-0000-0000-0000000000c1","qty":10,"unit_cost":60000},
           {"product_id":"00000000-0000-0000-0000-0000000000c2","qty":5,"unit_cost":30000}]}') ->> 'id')::uuid, 0);

select tests.login(tests.uid('staff'));
select create_order(jsonb_build_object('store_id', tests.store('A'), 'channel', 'facebook', 'external_order_id', 'G1',
  'deliver_now', true, 'payment_method', 'transfer',
  'items', jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000c1', 'qty', 3, 'unit_price', 100000))));
select tests.logout();
select is((select qty_on_hand from inventory where product_id = '00000000-0000-0000-0000-0000000000c1'), 7::numeric, 'giao xong A con 7');

-- Doi: A 3 -> 1, them B 2
select tests.login(tests.uid('staff'));
select lives_ok($$ select update_order((select id from orders where external_order_id = 'G1'), jsonb_build_object(
  'external_order_id', 'G1', 'channel', 'facebook', 'payment_method', 'transfer', 'discount_amount', 0,
  'items', jsonb_build_array(
    jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000c1', 'qty', 1, 'unit_price', 100000),
    jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000c2', 'qty', 2, 'unit_price', 50000)))) $$,
  'doi san pham va so luong don da giao');
select tests.logout();
select is((select qty_on_hand from inventory where product_id = '00000000-0000-0000-0000-0000000000c1'), 9::numeric, 'A tra lai 2: con 9');
select is((select qty_on_hand from inventory where product_id = '00000000-0000-0000-0000-0000000000c2'), 3::numeric, 'B xuat 2: con 3');
select is((select sum(qty_on_hand) from stock_lots where product_id = '00000000-0000-0000-0000-0000000000c1'), 9::numeric, 'lo A khop ton');
select is((select count(*)::int from sale_items where sale_id = (select sale_id from orders where external_order_id = 'G1')), 2, 'giao dich co 2 dong');
select is((select subtotal || ':' || total || ':' || cogs_total from sales where id = (select sale_id from orders where external_order_id = 'G1')),
  '200000:200000:120000', 'tien hang 200.000, gia von 60.000 + 2 x 30.000');
select is((select sum(amount) from sale_payments where sale_id = (select sale_id from orders where external_order_id = 'G1')),
  200000::numeric, 'thanh toan theo tong moi');
select is((select subtotal from orders where external_order_id = 'G1'), 200000::bigint, 'tien hang don');
select is((select count(*)::int from sales where order_id = (select id from orders where external_order_id = 'G1')), 1,
  'van mot giao dich ban (giu ma va ngay giao)');

-- Vuot ton: loi, khong doi gi
select tests.login(tests.uid('staff'));
select throws_like($$ select update_order((select id from orders where external_order_id = 'G1'), jsonb_build_object(
  'external_order_id', 'G1', 'items', jsonb_build_array(
    jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000c2', 'qty', 6, 'unit_price', 50000)))) $$,
  '%chỉ còn%', 'khong xuat vuot ton');
select tests.logout();
select is((select qty_on_hand from inventory where product_id = '00000000-0000-0000-0000-0000000000c2'), 3::numeric, 'loi thi ton khong doi');

select * from finish();
rollback;
