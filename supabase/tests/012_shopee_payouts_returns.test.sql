-- Doi soat tien Shopee va hoan hang don online.
begin;
-- @include setup.sql

select plan(24);

insert into suppliers (id, name, payment_terms_days) values ('00000000-0000-0000-0000-0000000000e1', 'NCC Test', 0);
insert into products (id, name, unit, goods_type, sell_price, expiry_level) values
  ('00000000-0000-0000-0000-0000000000c1', 'Bánh A', 'Gói', 'air', 100000, 'none');
insert into money_accounts (id, name, kind) values ('00000000-0000-0000-0000-0000000000f1', 'VCB', 'bank');

select tests.login(tests.uid('admin'));
select confirm_purchase_receipt((save_purchase_receipt('{"store_id":"00000000-0000-0000-0000-00000000000a",
  "supplier_id":"00000000-0000-0000-0000-0000000000e1","receipt_date":"2026-09-01",
  "items":[{"product_id":"00000000-0000-0000-0000-0000000000c1","qty":10,"unit_cost":60000}]}') ->> 'id')::uuid, 0);

-- 3 don Shopee giao thanh cong: 100.000, 200.000, 100.000
select tests.login(tests.uid('staff'));
select create_order(jsonb_build_object('store_id', tests.store('A'), 'channel', 'shopee', 'external_order_id', 'S' || n,
  'items', jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000c1', 'qty', q, 'unit_price', 100000))))
from (values (1, 1), (2, 2), (3, 1)) v(n, q);
select update_order_status(id, 'delivered') from orders where channel = 'shopee';
select tests.logout();
select is((select qty_on_hand from inventory where store_id = tests.store('A')), 6::numeric, 'giao 4 goi, ton con 6');

-- 1. Phan quyen doi soat
select tests.login(tests.uid('staff'));
select throws_ok($$ select record_platform_payout(jsonb_build_object('store_id', tests.store('A'),
  'account_id', '00000000-0000-0000-0000-0000000000f1', 'amount_received', 1,
  'order_ids', jsonb_build_array((select id from orders where external_order_id = 'S1')))) $$,
  'P0001', null, 'nhan vien khong doi soat');

-- 2. Ke toan doi soat S1 + S2 (300.000), nhan 270.000, quang cao 5.000 -> phi san 25.000
select tests.login(tests.uid('acc'));
select throws_like($$ select record_platform_payout(jsonb_build_object('store_id', tests.store('A'),
  'amount_received', 1, 'order_ids', jsonb_build_array((select id from orders where external_order_id = 'S1')))) $$,
  '%tài khoản%', 'bat buoc chon tai khoan');
select lives_ok($$ select record_platform_payout(jsonb_build_object('store_id', tests.store('A'),
  'account_id', '00000000-0000-0000-0000-0000000000f1', 'amount_received', 270000, 'ads_amount', 5000,
  'received_on', '2026-09-10',
  'order_ids', (select jsonb_agg(id) from orders where external_order_id in ('S1','S2')))) $$, 'ghi dot doi soat');
select is((select orders_total from platform_payouts), 300000::bigint, 'tong don 300.000');
select is((select fee_amount from platform_payouts), 25000::bigint, 'phi san = 300.000 - 270.000 - 5.000');
select is((select count(*) from orders where payout_id is not null), 2::bigint, '2 don da nhan tien');
select is((select amount from cash_transactions t join expense_categories c on c.id = t.category_id
           where c.name = 'Phí sàn Shopee'), 25000::bigint, 'khoan chi phi san');
select is((select amount from cash_transactions t join expense_categories c on c.id = t.category_id
           where c.name = 'Quảng cáo Shopee'), 5000::bigint, 'khoan chi quang cao');
select is((select balance from money_account_balances() where name = 'VCB'), 270000::bigint, 'so du VCB = so tien thuc nhan');
select throws_like($$ select record_platform_payout(jsonb_build_object('store_id', tests.store('A'),
  'account_id', '00000000-0000-0000-0000-0000000000f1', 'amount_received', 1,
  'order_ids', jsonb_build_array((select id from orders where external_order_id = 'S1')))) $$,
  '%đã được đối soát%', 'don da doi soat khong chon lai');

-- 3. Huy dot doi soat: chi quan ly
select throws_ok($$ select cancel_platform_payout((select id from platform_payouts), 'nhầm') $$,
  'P0001', null, 'ke toan khong huy dot doi soat');
select tests.login(tests.uid('admin'));
select lives_ok($$ select cancel_platform_payout((select id from platform_payouts), 'Tick nhầm') $$, 'quan ly huy dot');
select is((select count(*) from orders where payout_id is not null), 0::bigint, 'don tro ve cho Shopee tra');
select is((select count(*) from cash_transactions), 0::bigint, 'xoa khoan chi sinh tu dot');
select is((select balance from money_account_balances() where name = 'VCB'), 0::bigint, 'so du VCB ve 0');

-- 4. Hoan hang S2 (2 goi): bo doanh thu, chua vao kho
select tests.login(tests.uid('staff'));
select throws_like($$ select return_order((select id from orders where external_order_id = 'S2'), ' ') $$,
  '%lý do%', 'hoan hang phai co ly do');
select lives_ok($$ select return_order((select id from orders where external_order_id = 'S2'), 'Khách trả') $$, 'hoan hang');
select is((select status::text from sales where order_id = (select id from orders where external_order_id = 'S2')),
  'cancelled', 'giao dich ban bi huy');
select tests.logout();
select is((select qty_on_hand from inventory where store_id = tests.store('A')), 6::numeric, 'chua nhap lai kho khi cho kiem');
select tests.login(tests.uid('staff'));
select throws_ok($$ select review_order_return((select id from orders where external_order_id = 'S2'), true) $$,
  'P0001', null, 'nhan vien khong duyet hang hoan');

-- 5. Quan ly duyet nhap lai kho
select tests.login(tests.uid('admin'));
select lives_ok($$ select review_order_return((select id from orders where external_order_id = 'S2'), true) $$, 'duyet nhap kho');
select is((select qty_on_hand from inventory where store_id = tests.store('A')), 8::numeric, 'ton tang lai 2');

-- 6. Hoan hang S3, hang hong khong nhap kho
select return_order((select id from orders where external_order_id = 'S3'), 'Bể');
select review_order_return((select id from orders where external_order_id = 'S3'), false, 'Hàng móp');
select is((select return_status from orders where external_order_id = 'S3'), 'discarded', 'hang hong khong nhap kho');

select * from finish();
rollback;
