-- Sua thong tin don online: thong tin khach, tien, giao dich ban cua don da giao.
begin;
-- @include setup.sql

select plan(14);

insert into suppliers (id, name, payment_terms_days) values ('00000000-0000-0000-0000-0000000000e1', 'NCC Test', 0);
insert into products (id, name, unit, goods_type, sell_price, expiry_level) values
  ('00000000-0000-0000-0000-0000000000c1', 'Bánh A', 'Gói', 'air', 100000, 'none');
insert into money_accounts (id, name, kind) values ('00000000-0000-0000-0000-0000000000f1', 'VCB', 'bank');

select tests.login(tests.uid('admin'));
select confirm_purchase_receipt((save_purchase_receipt('{"store_id":"00000000-0000-0000-0000-00000000000a",
  "supplier_id":"00000000-0000-0000-0000-0000000000e1","receipt_date":"2026-09-01",
  "items":[{"product_id":"00000000-0000-0000-0000-0000000000c1","qty":10,"unit_cost":60000}]}') ->> 'id')::uuid, 0);

select tests.login(tests.uid('staff'));
select create_order(jsonb_build_object('store_id', tests.store('A'), 'channel', 'shopee', 'external_order_id', 'E1',
  'items', jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000c1', 'qty', 2, 'unit_price', 100000))));
select create_order(jsonb_build_object('store_id', tests.store('A'), 'channel', 'shopee', 'external_order_id', 'E2',
  'items', jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000c1', 'qty', 1, 'unit_price', 100000))));

-- 1. Don cho giao: sua khach, giam gia, tien Shopee tra ve
select lives_ok($$ select update_order((select id from orders where external_order_id = 'E1'), jsonb_build_object(
  'external_order_id', 'E1', 'customer_name', ' Lan ', 'shipping_fee', 0, 'discount_amount', 20000,
  'discount_note', 'Voucher shop', 'payout_amount', 150000, 'payment_method', 'transfer')) $$, 'sua don cho giao');
select is((select customer_name from orders where external_order_id = 'E1'), 'Lan', 'ten khach da sua');
select is((select total from orders where external_order_id = 'E1'), 180000::bigint, 'tong = 200.000 - 20.000');
select is((select platform_fee from orders where external_order_id = 'E1'), 30000::bigint, 'phi san = 180.000 - 150.000');
select throws_like($$ select update_order((select id from orders where external_order_id = 'E1'),
  jsonb_build_object('external_order_id', 'E2')) $$, '%đã được nhập%', 'khong trung ma don san');
select throws_like($$ select update_order((select id from orders where external_order_id = 'E1'),
  jsonb_build_object('external_order_id', 'E1', 'discount_amount', 250000)) $$, '%lớn hơn tiền hàng%', 'giam gia khong vuot tien hang');
select throws_like($$ select update_order((select id from orders where external_order_id = 'E1'),
  jsonb_build_object('external_order_id', 'E1', 'payout_amount', 190000, 'discount_amount', 20000)) $$,
  '%Tiền sàn trả về%', 'tien san tra ve khong vuot tien hang sau giam');

-- 2. Don da giao: giao dich ban cap nhat theo
select update_order_status((select id from orders where external_order_id = 'E1'), 'delivered');
select lives_ok($$ select update_order((select id from orders where external_order_id = 'E1'), jsonb_build_object(
  'external_order_id', 'E1', 'discount_amount', 10000, 'discount_note', 'Sửa', 'payout_amount', 160000,
  'payment_method', 'cash')) $$, 'sua don da giao');
select tests.logout();
select is((select s.total from sales s join orders o on o.sale_id = s.id where o.external_order_id = 'E1'),
  190000::bigint, 'tong giao dich = 200.000 - 10.000');
select is((select s.discount_note from sales s join orders o on o.sale_id = s.id where o.external_order_id = 'E1'),
  'Sửa', 'ly do giam gia giao dich da sua');
select is((select sum(sp.amount) || ':' || min(sp.method::text) from sale_payments sp join orders o on o.sale_id = sp.sale_id
  where o.external_order_id = 'E1'), '190000:cash', 'dong thanh toan theo tong va phuong thuc moi');
select is((select platform_fee from orders where external_order_id = 'E1'), 30000::bigint, 'phi san tinh lai');

-- 3. Khoa khi da doi soat hoac da huy
select tests.login(tests.uid('admin'));
select record_platform_payout(jsonb_build_object('store_id', tests.store('A'), 'channel', 'shopee',
  'account_id', '00000000-0000-0000-0000-0000000000f1', 'received_on', '2026-10-04', 'amount_received', 160000,
  'ads_amount', 0, 'order_ids', jsonb_build_array((select id from orders where external_order_id = 'E1'))));
select throws_like($$ select update_order((select id from orders where external_order_id = 'E1'),
  jsonb_build_object('external_order_id', 'E1')) $$, '%đối soát%', 'don da doi soat khong sua');
select update_order_status((select id from orders where external_order_id = 'E2'), 'cancelled', 'Khách hủy');
select throws_like($$ select update_order((select id from orders where external_order_id = 'E2'),
  jsonb_build_object('external_order_id', 'E2')) $$, '%đã hủy%', 'don da huy khong sua');

select * from finish();
rollback;
