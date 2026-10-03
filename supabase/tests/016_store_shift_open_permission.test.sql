-- Mot ca cho mot ket: quyen mo ca rieng, ban chung ca cua cua hang.
begin;
-- @include setup.sql

select plan(12);

insert into products (id, name, unit, goods_type, sell_price, expiry_level) values
  ('00000000-0000-0000-0000-0000000000c1', 'Bánh A', 'Gói', 'air', 100000, 'none');
insert into suppliers (id, name, payment_terms_days) values ('00000000-0000-0000-0000-0000000000e1', 'NCC Test', 0);
select tests.login(tests.uid('admin'));
select confirm_purchase_receipt((save_purchase_receipt('{"store_id":"00000000-0000-0000-0000-00000000000a",
  "supplier_id":"00000000-0000-0000-0000-0000000000e1","receipt_date":"2026-09-01",
  "items":[{"product_id":"00000000-0000-0000-0000-0000000000c1","qty":10,"unit_cost":60000}]}') ->> 'id')::uuid, 0);
select tests.logout();

-- 1. Chua duoc cap quyen thi khong mo ca
update profiles set extra_permissions = '{}' where id = tests.uid('staff');
select tests.login(tests.uid('staff'));
select throws_like($$ select open_shift(tests.store('A'), 0) $$, '%chưa được cấp quyền mở ca%', 'nhan vien chua co quyen khong mo ca');
select throws_like($$ select complete_sale(jsonb_build_object('store_id', tests.store('A'),
  'items', jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000c1', 'qty', 1)),
  'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 100000)))) $$,
  '%chưa mở ca%', 'chua co ca thi khong ban');

-- 2. Nguoi co quyen mo ca; cua hang chi mot ca dang mo
select tests.login(tests.uid('admin'));
select lives_ok($$ select open_shift(tests.store('A'), 500000) $$, 'admin co quyen mo ca');
select tests.login(tests.uid('sadmin'));
select throws_like($$ select open_shift(tests.store('A'), 0) $$, '%đang có ca%chưa chốt%', 'khong mo ca thu hai cung cua hang');

-- 3. Nhan vien khong co quyen van ban vao ca cua cua hang
select tests.login(tests.uid('staff'));
select lives_ok($$ select complete_sale(jsonb_build_object('store_id', tests.store('A'), 'idempotency_key', 'k-staff',
  'items', jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000c1', 'qty', 1)),
  'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 100000)))) $$, 'nhan vien ban vao ca chung');
select is((select count(*) from shifts where status = 'open' and store_id = tests.store('A')), 1::bigint, 'nhan vien thay ca dang mo');
select is((shift_summary((select id from shifts where status = 'open')) ->> 'expected_cash')::bigint, 600000::bigint,
  'tien mat ky vong gom giao dich cua nhan vien');
select tests.login(tests.uid('admin'));
select lives_ok($$ select complete_sale(jsonb_build_object('store_id', tests.store('A'), 'idempotency_key', 'k-admin',
  'items', jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000c1', 'qty', 1)),
  'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 100000)))) $$, 'admin ban vao cung ca');
select tests.logout();
select is((select count(distinct shift_id) from sales where idempotency_key in ('k-staff','k-admin')), 1::bigint,
  'hai nguoi ban cung mot ca');

-- 4. Nhan vien chi huy giao dich cua minh trong ca dang mo
select tests.login(tests.uid('staff'));
select throws_like($$ select cancel_sale((select id from sales where idempotency_key = 'k-admin'), 'nhầm') $$,
  '%giao dịch của mình%', 'nhan vien khong huy giao dich nguoi khac');
select lives_ok($$ select cancel_sale((select id from sales where idempotency_key = 'k-staff'), 'nhầm') $$,
  'nhan vien huy giao dich cua minh');

-- 5. Cua hang khac khong thay ca nay
select tests.login(tests.uid('staffb'));
select is((select count(*) from shifts where store_id = tests.store('A')), 0::bigint, 'nhan vien cua hang B khong thay ca A');

select * from finish();
rollback;
