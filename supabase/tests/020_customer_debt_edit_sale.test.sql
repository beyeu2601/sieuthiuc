-- Khach ghi no tai quay, thu no, sua giao dich ban.
begin;
-- @include setup.sql

select plan(19);

insert into products (id, name, unit, goods_type, sell_price, expiry_level) values
  ('00000000-0000-0000-0000-0000000000c1', 'Bào ngư', 'Hộp', 'air', 1300000, 'none');
insert into suppliers (id, name, payment_terms_days) values ('00000000-0000-0000-0000-0000000000e1', 'NCC Test', 0);
insert into money_accounts (id, name, kind) values
  ('00000000-0000-0000-0000-0000000000f1', 'VCB', 'bank'),
  ('00000000-0000-0000-0000-0000000000f2', 'Két', 'cash');
select tests.login(tests.uid('admin'));
select confirm_purchase_receipt((save_purchase_receipt('{"store_id":"00000000-0000-0000-0000-00000000000a",
  "supplier_id":"00000000-0000-0000-0000-0000000000e1","receipt_date":"2026-09-01",
  "items":[{"product_id":"00000000-0000-0000-0000-0000000000c1","qty":10,"unit_cost":800000}]}') ->> 'id')::uuid, 0);
select open_shift(tests.store('A'), 0);

-- 1. Ban 900.000 (giam 400.000), khach tra 300.000 tien mat, ghi no 600.000
select tests.login(tests.uid('staff'));
select throws_like($$ select complete_sale(jsonb_build_object('store_id', tests.store('A'), 'idempotency_key', 'k0',
  'items', jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000c1', 'qty', 1)),
  'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 1000000)),
  'debt', jsonb_build_object('amount', 300000))) $$, '%tên khách%', 'ghi no phai co ten khach');
select tests.login(tests.uid('admin'));
select lives_ok($$ select complete_sale(jsonb_build_object('store_id', tests.store('A'), 'idempotency_key', 'k1',
  'discount_amount', 400000, 'discount_note', 'Giá vốn cho dì Phương',
  'items', jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000c1', 'qty', 1)),
  'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 300000, 'account_id', '00000000-0000-0000-0000-0000000000f2')),
  'debt', jsonb_build_object('amount', 600000, 'customer_name', 'Dì Phương', 'customer_phone', '0900000000'))) $$,
  'ban co ghi no');
select is((select total from sales where idempotency_key = 'k1'), 900000::bigint, 'doanh thu ghi du tong don');
select is((select remaining from customer_debts where sale_id = (select id from sales where idempotency_key = 'k1')),
  600000::bigint, 'khoan no khach 600.000');
select is((shift_summary((select id from shifts where status = 'open')) ->> 'expected_cash')::bigint, 300000::bigint,
  'tien mat ky vong chi tinh phan tra tien mat');

-- 2. Thu no: 200.000 tien mat vao ket (vao ca), 400.000 chuyen khoan
select tests.login(tests.uid('staff'));
select lives_ok($$ select collect_customer_debt((select id from customer_debts limit 1),
  '{"amount":200000,"account_id":"00000000-0000-0000-0000-0000000000f2"}') $$, 'nhan vien thu no tien mat');
select is((shift_summary((select id from shifts where status = 'open')) ->> 'expected_cash')::bigint, 500000::bigint,
  'thu no tien mat cong vao ca');
select throws_ok($$ select collect_customer_debt((select id from customer_debts limit 1),
  '{"amount":500000,"account_id":"00000000-0000-0000-0000-0000000000f1"}') $$, 'P0001', null, 'khong thu vuot so con no');
select lives_ok($$ select collect_customer_debt((select id from customer_debts limit 1),
  '{"amount":400000,"account_id":"00000000-0000-0000-0000-0000000000f1"}') $$, 'thu het no bang chuyen khoan');
select is((select status::text from customer_debts limit 1), 'paid', 'khoan no da tra du');
select tests.login(tests.uid('admin'));
select is((select balance from money_account_balances() where id = '00000000-0000-0000-0000-0000000000f1'),
  400000::bigint, 'so du tai khoan gom tien thu no');

-- 3. Da thu no thi khong huy giao dich, khong doi so tien no
select throws_like($$ select cancel_sale((select id from sales where idempotency_key = 'k1'), 'Sai') $$,
  '%đã trả một phần nợ%', 'khong huy giao dich da thu no');
select throws_like($$ select update_sale((select id from sales where idempotency_key = 'k1'), jsonb_build_object(
  'discount_amount', 400000, 'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 400000, 'account_id', '00000000-0000-0000-0000-0000000000f2')),
  'debt', jsonb_build_object('amount', 500000, 'customer_name', 'Dì Phương'))) $$,
  '%không đổi được số tiền ghi nợ%', 'khong doi so no da thu');

-- 4. Sua giao dich khac: doi giam gia va thanh toan
select complete_sale(jsonb_build_object('store_id', tests.store('A'), 'idempotency_key', 'k2',
  'items', jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000c1', 'qty', 1)),
  'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 1300000, 'account_id', '00000000-0000-0000-0000-0000000000f2'))));
select lives_ok($$ select update_sale((select id from sales where idempotency_key = 'k2'), jsonb_build_object(
  'discount_amount', 300000, 'discount_note', 'Khách quen',
  'payments', jsonb_build_array(jsonb_build_object('method', 'transfer', 'amount', 1000000, 'account_id', '00000000-0000-0000-0000-0000000000f1')))) $$,
  'admin sua giam gia va thanh toan');
select is((select total from sales where idempotency_key = 'k2'), 1000000::bigint, 'tong moi sau giam gia');
select is((shift_summary((select id from shifts where status = 'open')) ->> 'expected_cash')::bigint, 500000::bigint,
  'doi tien mat sang chuyen khoan thi bo khoi tien mat ky vong');
select throws_like($$ select update_sale((select id from sales where idempotency_key = 'k2'), jsonb_build_object(
  'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 100, 'account_id', '00000000-0000-0000-0000-0000000000f2')))) $$,
  '%khác tổng đơn%', 'thanh toan phai bang tong');

-- 5. Nhan vien khong sua giao dich cua nguoi khac
select tests.login(tests.uid('staff'));
select throws_like($$ select update_sale((select id from sales where idempotency_key = 'k2'), '{}') $$,
  '%của mình%', 'nhan vien khong sua giao dich cua nguoi khac');

-- 6. Ca da chot thi khong sua
select tests.login(tests.uid('admin'));
select close_shift((select id from shifts where status = 'open'), 500000, null);
select throws_like($$ select update_sale((select id from sales where idempotency_key = 'k2'), jsonb_build_object(
  'payments', jsonb_build_array(jsonb_build_object('method', 'transfer', 'amount', 1300000, 'account_id', '00000000-0000-0000-0000-0000000000f1')))) $$,
  '%đã chốt%', 'ca da chot thi khong sua');

select * from finish();
rollback;
