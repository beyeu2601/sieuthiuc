-- Sua don online: kenh ban, dong san pham (don chua giao), gia ban (don da giao).
begin;
-- @include setup.sql

select plan(17);

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
select create_order(jsonb_build_object('store_id', tests.store('A'), 'channel', 'shopee', 'external_order_id', 'F1',
  'items', jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000c1', 'qty', 2, 'unit_price', 100000))));

-- 1. Don cho giao: doi kenh, doi dong (bot A, them B), giu hang theo dong moi
select lives_ok($$ select update_order((select id from orders where external_order_id = 'F1'), jsonb_build_object(
  'external_order_id', 'F1', 'channel', 'facebook', 'payout_amount', 1000, 'payment_method', 'transfer',
  'items', jsonb_build_array(
    jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000c1', 'qty', 1, 'unit_price', 90000),
    jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000c2', 'qty', 3, 'unit_price', 40000)))) $$,
  'sua dong va kenh don cho giao');
select tests.logout();
select is((select channel::text from orders where external_order_id = 'F1'), 'facebook', 'kenh da doi');
select is((select subtotal from orders where external_order_id = 'F1'), 210000::bigint, 'tien hang = 90.000 + 3 x 40.000');
select is((select platform_fee from orders where external_order_id = 'F1'), 0::bigint, 'khong phai Shopee thi khong co phi san');
select is((select qty_reserved from inventory where product_id = '00000000-0000-0000-0000-0000000000c1'), 1::numeric, 'A giu 1');
select is((select qty_reserved from inventory where product_id = '00000000-0000-0000-0000-0000000000c2'), 3::numeric, 'B giu 3');
select is((select count(*)::int from audit_logs where action = 'order.update'), 1, 'ghi audit sua don');

select tests.login(tests.uid('staff'));
select throws_like($$ select update_order((select id from orders where external_order_id = 'F1'), jsonb_build_object(
  'external_order_id', 'F1', 'items', jsonb_build_array(
    jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000c2', 'qty', 6, 'unit_price', 40000)))) $$,
  '%chỉ còn%', 'khong giu vuot kha dung');
select tests.logout();
select is((select qty_reserved from inventory where product_id = '00000000-0000-0000-0000-0000000000c1'), 1::numeric,
  'loi thi giu hang khong doi');

-- 2. Don da giao: chi doi gia ban, giao dich ban cap nhat theo
select tests.login(tests.uid('staff'));
select update_order_status((select id from orders where external_order_id = 'F1'), 'delivered');
select lives_ok($$ select update_order((select id from orders where external_order_id = 'F1'), jsonb_build_object(
  'external_order_id', 'F1', 'channel', 'facebook', 'discount_amount', 10000, 'payment_method', 'transfer',
  'items', jsonb_build_array(
    jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000c1', 'qty', 1, 'unit_price', 95000),
    jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000c2', 'qty', 3, 'unit_price', 40000)))) $$,
  'sua gia don da giao');
select throws_like($$ select update_order((select id from orders where external_order_id = 'F1'), jsonb_build_object(
  'external_order_id', 'F1', 'items', jsonb_build_array(
    jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000c1', 'qty', 2, 'unit_price', 95000),
    jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000c2', 'qty', 3, 'unit_price', 40000)))) $$,
  '%chỉ sửa được giá bán%', 'don da giao khong doi so luong');
select throws_like($$ select update_order((select id from orders where external_order_id = 'F1'), jsonb_build_object(
  'external_order_id', 'F1', 'items', jsonb_build_array(
    jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000c1', 'qty', 1, 'unit_price', 95000)))) $$,
  '%chỉ sửa được giá bán%', 'don da giao khong bot dong');
select tests.logout();
select is((select subtotal || ':' || total || ':' || channel::text from sales s where s.id = (select sale_id from orders where external_order_id = 'F1')),
  '215000:205000:facebook', 'giao dich: tien hang 215.000, tong 205.000, kenh');
select is((select unit_price || ':' || line_total from sale_items where product_id = '00000000-0000-0000-0000-0000000000c1'
  and sale_id = (select sale_id from orders where external_order_id = 'F1')), '95000:95000', 'dong ban theo gia moi');
select is((select cogs from sale_items where product_id = '00000000-0000-0000-0000-0000000000c1'
  and sale_id = (select sale_id from orders where external_order_id = 'F1')), 60000::bigint, 'gia von giu nguyen');
select is((select sum(amount) from sale_payments where sale_id = (select sale_id from orders where external_order_id = 'F1')),
  205000::numeric, 'thanh toan theo tong moi');
select is((select total from orders where external_order_id = 'F1'), 205000::bigint, 'tong don');

select * from finish();
rollback;
