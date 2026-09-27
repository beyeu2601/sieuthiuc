-- Workflow 26/09: tai khoan giu tien + gia ban tren dong phieu nhap.
begin;
-- @include setup.sql

select plan(11);

insert into suppliers (id, name, payment_terms_days) values ('00000000-0000-0000-0000-0000000000f1', 'NCC MA', 0);
insert into products (id, name, unit, goods_type, sell_price, expiry_level) values
  ('00000000-0000-0000-0000-0000000000d1', 'Nuoc rua chen', 'Chai', 'cont', 30000, 'none');

-- 1. Chi sadmin duoc tao tai khoan
select tests.login(tests.uid('admin'));
select throws_like($$ select manage_money_account('{"name":"Ket admin","kind":"cash"}') $$, '%không có quyền%',
  'admin khong tao duoc tai khoan tien');
select tests.logout();

select tests.login(tests.uid('sadmin'));
select lives_ok($$ select manage_money_account('{"name":"Ket tien mat","kind":"cash","opening_balance":1000000}') $$,
  'sadmin tao tai khoan tien mat');
select lives_ok($$ select manage_money_account('{"name":"VCB","kind":"bank"}') $$, 'sadmin tao tai khoan ngan hang');
select is((select balance from money_account_balances() where name = 'Ket tien mat'), 1000000::bigint,
  'so du dau = so du hien tai khi chua co giao dich');

-- 2. Thu chi ghi vao tai khoan lam thay doi so du
insert into expense_categories (id, name, kind) values ('00000000-0000-0000-0000-0000000000f2', 'Ban le', 'income');
select create_cash_transaction(jsonb_build_object('store_id', tests.store('A'), 'kind', 'income',
  'category_id', '00000000-0000-0000-0000-0000000000f2', 'amount', 200000, 'method', 'cash', 'description', 'Thu le',
  'account_id', (select id from money_accounts where name = 'Ket tien mat')));
select is((select balance from money_account_balances() where name = 'Ket tien mat'), 1200000::bigint,
  'thu tien mat cong vao so du tai khoan');

-- 3. Tai khoan da khoa thi khong nhan giao dich
select manage_money_account((select jsonb_build_object('id', id, 'name', name, 'kind', kind, 'is_active', false)
  from money_accounts where name = 'VCB'));
select throws_like($$ select create_cash_transaction(jsonb_build_object('store_id', tests.store('A'), 'kind', 'income',
  'category_id', '00000000-0000-0000-0000-0000000000f2', 'amount', 50000, 'method', 'transfer', 'description', 'Thu ck',
  'account_id', (select id from money_accounts where name = 'VCB'))) $$, '%đã khóa%',
  'khong ghi duoc vao tai khoan da khoa');

-- 4. Gia ban tren dong phieu nhap: xac nhan cap nhat gia ban san pham
select confirm_purchase_receipt((save_purchase_receipt(jsonb_build_object('store_id', tests.store('A'),
  'supplier_id', '00000000-0000-0000-0000-0000000000f1', 'receipt_date', '2026-09-10',
  'items', jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000d1',
    'qty', 5, 'unit_cost', 18000, 'sell_price', 35000)))) ->> 'id')::uuid,
  90000, 'cash', null, false, (select id from money_accounts where name = 'Ket tien mat'));
select is((select sell_price from products where id = '00000000-0000-0000-0000-0000000000d1'), 35000::bigint,
  'gia ban san pham cap nhat theo dong phieu nhap');
select is((select count(*) from price_history where product_id = '00000000-0000-0000-0000-0000000000d1'
  and field = 'sell_price'), 1::bigint, 'co ghi lich su gia ban');
select is((select balance from money_account_balances() where name = 'Ket tien mat'), 1110000::bigint,
  'tra NCC tien mat tru vao so du tai khoan');

-- 5. Khong nhap sell_price thi giu nguyen gia ban cu
insert into products (id, name, unit, goods_type, sell_price, expiry_level) values
  ('00000000-0000-0000-0000-0000000000d2', 'Khan giay', 'Bich', 'cont', 20000, 'none');
select confirm_purchase_receipt((save_purchase_receipt(jsonb_build_object('store_id', tests.store('A'),
  'supplier_id', '00000000-0000-0000-0000-0000000000f1', 'receipt_date', '2026-09-11',
  'items', jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000d2',
    'qty', 3, 'unit_cost', 12000)))) ->> 'id')::uuid, 0);
select is((select sell_price from products where id = '00000000-0000-0000-0000-0000000000d2'), 20000::bigint,
  'khong nhap gia ban thi giu nguyen gia cu');
select is((select count(*) from price_history where product_id = '00000000-0000-0000-0000-0000000000d2'
  and field = 'sell_price'), 0::bigint, 'khong ghi lich su gia khi khong doi gia ban');

select tests.logout();
select * from finish();
rollback;
