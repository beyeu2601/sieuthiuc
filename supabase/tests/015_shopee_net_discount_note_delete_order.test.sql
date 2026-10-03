-- Don Shopee nhap tien san tra ve, tao don da giao, ly do giam gia, xoa don.
begin;
-- @include setup.sql

select plan(20);

insert into suppliers (id, name, payment_terms_days) values ('00000000-0000-0000-0000-0000000000e1', 'NCC Test', 0);
insert into products (id, name, unit, goods_type, sell_price, expiry_level) values
  ('00000000-0000-0000-0000-0000000000c1', 'Bánh A', 'Gói', 'air', 100000, 'none');
insert into money_accounts (id, name, kind) values ('00000000-0000-0000-0000-0000000000f1', 'VCB', 'bank');

select tests.login(tests.uid('admin'));
select confirm_purchase_receipt((save_purchase_receipt('{"store_id":"00000000-0000-0000-0000-00000000000a",
  "supplier_id":"00000000-0000-0000-0000-0000000000e1","receipt_date":"2026-09-01",
  "items":[{"product_id":"00000000-0000-0000-0000-0000000000c1","qty":10,"unit_cost":60000}]}') ->> 'id')::uuid, 0);

-- 1. Tien san tra ve: 2 goi x 100.000, giam 10.000, Shopee tra 160.000 -> phi san 30.000
select tests.login(tests.uid('staff'));
select throws_like($$ select create_order(jsonb_build_object('store_id', tests.store('A'), 'channel', 'shopee',
  'payout_amount', 250000,
  'items', jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000c1', 'qty', 2, 'unit_price', 100000)))) $$,
  '%Tiền sàn trả về%', 'tien san tra ve khong vuot tien hang');
select lives_ok($$ select create_order(jsonb_build_object('store_id', tests.store('A'), 'channel', 'shopee',
  'external_order_id', 'N1', 'discount_amount', 10000, 'discount_note', 'Khách quen', 'payout_amount', 160000,
  'items', jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000c1', 'qty', 2, 'unit_price', 100000)))) $$,
  'tao don co tien san tra ve');
select is((select platform_fee from orders where external_order_id = 'N1'), 30000::bigint, 'phi san = 190.000 - 160.000');
select is((select discount_amount from orders where external_order_id = 'N1'), 10000::bigint, 'giam gia giu nguyen, khong gop phi san');
select is((select status::text from orders where external_order_id = 'N1'), 'pending', 'mac dinh cho giao');
select tests.logout();
select is((select qty_on_hand from inventory where store_id = tests.store('A')), 10::numeric, 'cho giao chua tru kho');
select tests.login(tests.uid('staff'));

-- 2. Giao: ly do giam gia sang giao dich ban
select update_order_status((select id from orders where external_order_id = 'N1'), 'delivered');
select is((select s.discount_note from sales s join orders o on o.sale_id = s.id where o.external_order_id = 'N1'),
  'Khách quen', 'ly do giam gia chep sang giao dich');

-- 3. Don gop tao da giao ngay, khong ma don san
select lives_ok($$ select create_order(jsonb_build_object('store_id', tests.store('A'), 'channel', 'shopee',
  'deliver_now', true, 'note', 'GOP', 'payout_amount', 250000,
  'items', jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000c1', 'qty', 3, 'unit_price', 100000)))) $$,
  'tao don gop da giao');
select is((select status::text from orders where note = 'GOP'), 'delivered', 'don gop o trang thai da giao');
select tests.logout();
select is((select qty_on_hand from inventory where store_id = tests.store('A')), 5::numeric, 'da tru kho 2 + 3');
select is((select qty_reserved from inventory where store_id = tests.store('A')), 0::numeric, 'khong con giu hang');
select is((select discount_note from orders where note = 'GOP'), null, 'khong giam thi khong luu ly do');

-- 4. Xoa don
select tests.login(tests.uid('admin'));
select throws_like($$ select delete_order((select id from orders where note = 'GOP')) $$,
  '%đã hủy hoặc đã hoàn%', 'khong xoa don dang giao thanh cong');
select return_order((select id from orders where note = 'GOP'), 'Thử');
select throws_like($$ select delete_order((select id from orders where note = 'GOP')) $$,
  '%đã hủy hoặc đã hoàn%', 'chua kiem hang hoan thi chua xoa');
select review_order_return((select id from orders where note = 'GOP'), true);
select tests.login(tests.uid('staff'));
select throws_ok($$ select delete_order((select id from orders where note = 'GOP')) $$,
  'P0001', null, 'nhan vien khong xoa don');
select tests.login(tests.uid('admin'));
select lives_ok($$ select delete_order((select id from orders where note = 'GOP')) $$, 'quan ly xoa don da hoan');
select is((select count(*) from orders where note = 'GOP'), 0::bigint, 'don da xoa');
select is((select qty_on_hand from inventory where store_id = tests.store('A')), 8::numeric, 'ton khong doi khi xoa (10 - 2)');
select is((select count(*) from stock_movements m
           where (m.ref_type = 'order' and not exists (select 1 from orders o where o.id = m.ref_id))
              or (m.ref_type = 'sale' and not exists (select 1 from sales s where s.id = m.ref_id))), 0::bigint,
  'xoa kem bien dong cua don va giao dich');

-- 5. POS luu ly do giam gia
select open_shift(tests.store('A'), 0);
select complete_sale(jsonb_build_object('store_id', tests.store('A'),
  'idempotency_key', 'k-note', 'discount_amount', 5000, 'discount_note', '  Hàng móp  ',
  'items', jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000c1', 'qty', 1)),
  'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 95000))));
select is((select discount_note from sales where idempotency_key = 'k-note'), 'Hàng móp', 'POS luu ly do giam gia');

select * from finish();
rollback;
