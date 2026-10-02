-- Thu chi do nguoi giu tai khoan duyet; sua/xoa khoan da duyet cung can duyet.
begin;
-- @include setup.sql

select plan(19);

insert into money_accounts (id, name, kind, opening_balance) values
  ('00000000-0000-0000-0000-0000000000f1', 'Ket test', 'cash', 1000000),
  ('00000000-0000-0000-0000-0000000000f2', 'Vi test', 'ewallet', 0);

-- 1. Cau hinh nguoi giu: admin duoc, nhan vien khong
select tests.login(tests.uid('staff'));
select throws_like($$ select set_money_account_holder('00000000-0000-0000-0000-0000000000f1', tests.uid('staff')) $$,
  '%không có quyền%', 'nhan vien khong cau hinh nguoi giu');
select tests.login(tests.uid('admin'));
select lives_ok($$ select set_money_account_holder('00000000-0000-0000-0000-0000000000f1', tests.uid('staff')) $$,
  'admin chon nhan vien giu ket');

-- 2. Nguoi giu tu xin thi tu duyet, khong can mo ca
select tests.login(tests.uid('staff'));
select is((create_cash_transaction(jsonb_build_object('store_id', tests.store('A'), 'kind', 'expense',
  'category_id', (select id from expense_categories where name = 'Điện'), 'description', 'Dien thang 9', 'amount', 100000,
  'method', 'cash', 'account_id', '00000000-0000-0000-0000-0000000000f1')) ->> 'approval_status'), 'approved',
  'nguoi giu xin chi: tu duyet');
select is((select balance from money_account_balances() where name = 'Ket test'), 900000::bigint, 'so du tru ngay');

-- 3. Nguoi khac xin: cho nguoi giu duyet; quan ly khong duyet thay
select tests.login(tests.uid('acc'));
select is((create_cash_transaction(jsonb_build_object('store_id', tests.store('A'), 'kind', 'expense',
  'category_id', (select id from expense_categories where name = 'Nước'), 'description', 'Nuoc thang 9', 'amount', 50000,
  'method', 'cash', 'account_id', '00000000-0000-0000-0000-0000000000f1')) ->> 'approval_status'), 'pending',
  'ke toan xin chi: cho duyet');
select is((select balance from money_account_balances() where name = 'Ket test'), 900000::bigint, 'cho duyet chua tru so du');
select tests.login(tests.uid('admin'));
select throws_like($$ select review_cash_transaction((select id from cash_transactions where description = 'Nuoc thang 9'), true) $$,
  '%người giữ tài khoản%', 'quan ly khong duyet thay nguoi giu');
select tests.login(tests.uid('staff'));
select lives_ok($$ select review_cash_transaction((select id from cash_transactions where description = 'Nuoc thang 9'), true) $$,
  'nguoi giu duyet');
select is((select balance from money_account_balances() where name = 'Ket test'), 850000::bigint, 'duyet xong tru so du');

-- 4. Xin xoa: nguoi tao xin, cho duyet; so du giu nguyen den khi duyet
select tests.login(tests.uid('acc'));
select is((request_cash_change((select id from cash_transactions where description = 'Nuoc thang 9'), 'delete', null, 'Ghi nham')
  ->> 'applied'), 'false', 'ke toan xin xoa: cho duyet');
select is((select balance from money_account_balances() where name = 'Ket test'), 850000::bigint, 'cho xoa chua doi so du');
select tests.login(tests.uid('staff'));
select lives_ok($$ select review_cash_transaction((select id from cash_transactions where description = 'Nuoc thang 9'), true) $$,
  'nguoi giu duyet xoa');
select is((select count(*) from cash_transactions where description = 'Nuoc thang 9'), 0::bigint, 'khoan da xoa');

-- 5. Nguoi khong phai nguoi tao, khong phai quan ly thi khong xin sua duoc
select tests.login(tests.uid('acc'));
select throws_like($$ select request_cash_change((select id from cash_transactions where description = 'Dien thang 9'), 'edit',
  '{"amount":120000}', 'Sai so') $$, '%người tạo hoặc quản lý%', 'ke toan khong xin sua khoan nguoi khac');

-- 6. Nguoi giu sua khoan minh tao: ap dung ngay
select tests.login(tests.uid('staff'));
select is((request_cash_change((select id from cash_transactions where description = 'Dien thang 9'), 'edit',
  '{"amount":120000}', 'Sai so') ->> 'applied'), 'true', 'nguoi giu sua: ap dung ngay');
select is((select balance from money_account_balances() where name = 'Ket test'), 880000::bigint, 'so du theo so moi');

-- 7. Tai khoan chua co nguoi giu: quan ly cua hang duyet
select is((create_cash_transaction(jsonb_build_object('store_id', tests.store('A'), 'kind', 'income',
  'category_id', (select id from expense_categories where name = 'Thu khác'), 'description', 'Ban thung carton', 'amount', 30000,
  'method', 'other', 'account_id', '00000000-0000-0000-0000-0000000000f2')) ->> 'approval_status'), 'pending',
  'nhan vien bao thu vao vi chua co nguoi giu: cho duyet');

-- 8. So tai khoan: nguoi giu xem duoc, nhan vien khac khong
select is((select balance_after from money_account_ledger('00000000-0000-0000-0000-0000000000f1') limit 1), 880000::bigint,
  'so tai khoan: so du sau dong moi nhat');
select tests.login(tests.uid('staffb'));
select throws_like($$ select * from money_account_ledger('00000000-0000-0000-0000-0000000000f1') $$,
  '%không có quyền%', 'nhan vien khac khong xem so tai khoan');

select * from finish();
rollback;
