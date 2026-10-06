-- Don dat truoc: coc theo %/so tien, so du tai khoan, hang ve giu kho, giao ghi ban kenh preorder, huy hoan/giu coc.
begin;
-- @include setup.sql

select plan(24);

insert into suppliers (id, name, payment_terms_days) values ('00000000-0000-0000-0000-0000000000e1', 'NCC Test', 0);
insert into products (id, name, unit, goods_type, sell_price, cost_price_ref, expiry_level) values
  ('00000000-0000-0000-0000-0000000000c1', 'Sữa A', 'Hộp', 'air', 500000, 300000, 'none'),
  ('00000000-0000-0000-0000-0000000000c2', 'Bánh B', 'Gói', 'air', 100000, 0, 'none');
insert into money_accounts (id, name, kind) values
  ('00000000-0000-0000-0000-0000000000f1', 'VCB', 'bank'),
  ('00000000-0000-0000-0000-0000000000f2', 'Két', 'cash');

-- 1. Nhan vien tao don, coc 30% chuyen khoan; gia von nhan vien gui len bi bo qua
select tests.login(tests.uid('staff'));
select lives_ok($$ select create_preorder(jsonb_build_object('store_id', tests.store('A'), 'customer_name', ' Lan ',
  'customer_phone', '0909', 'ordered_on', '2026-10-06', 'due_on', '2026-10-20',
  'deposit_type', 'percent', 'deposit_value', 30, 'account_id', '00000000-0000-0000-0000-0000000000f1', 'paid_on', '2026-10-06',
  'items', jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000c1', 'qty', 2,
    'unit_price', 450000, 'unit_cost', 1)))) $$, 'nhan vien tao don co coc');
select is((select subtotal from preorders where customer_name = 'Lan'), 900000::bigint, 'tien hang = 2 x 450.000');
select is((select sum(amount) from preorder_payments where kind = 'deposit'), 270000::numeric, 'coc 30% = 270.000');
select throws_ok($$ select unit_cost from preorder_items $$, '42501', null, 'nhan vien khong doc duoc gia von');
select throws_like($$ select create_preorder(jsonb_build_object('store_id', tests.store('A'), 'customer_name', 'X',
  'ordered_on', '2026-10-06', 'due_on', '2026-10-01',
  'items', jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000c1', 'qty', 1)))) $$,
  '%Ngày hẹn trả%', 'ngay hen tra khong truoc ngay dat');
select throws_like($$ select create_preorder(jsonb_build_object('store_id', tests.store('A'), 'customer_name', 'X',
  'due_on', '2026-12-01', 'deposit_type', 'amount', 'deposit_value', 50000,
  'account_id', '00000000-0000-0000-0000-0000000000f2',
  'items', jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000c1', 'qty', 1)))) $$,
  '%ca đang mở%', 'coc tien mat can ca mo');
select throws_like($$ select add_preorder_deposit((select id from preorders where customer_name = 'Lan'),
  jsonb_build_object('amount', 700000, 'account_id', '00000000-0000-0000-0000-0000000000f1')) $$,
  '%lớn hơn tiền hàng%', 'tong coc khong vuot tien hang');
select lives_ok($$ select add_preorder_deposit((select id from preorders where customer_name = 'Lan'),
  jsonb_build_object('amount', 30000, 'account_id', '00000000-0000-0000-0000-0000000000f1', 'paid_on', '2026-10-07')) $$,
  'thu them coc');

select tests.login(tests.uid('admin'));
select is((select unit_cost from preorder_costs((select id from preorders where customer_name = 'Lan'))), 300000::bigint,
  'gia von mac dinh = gia von tham chieu');
select is((select balance from money_account_balances() where id = '00000000-0000-0000-0000-0000000000f1'), 300000::bigint,
  'so du VCB = tong coc');
select is((select count(*) from money_account_ledger('00000000-0000-0000-0000-0000000000f1') where source = 'preorder'),
  2::bigint, 'so tai khoan co 2 dong coc');

-- 2. Hang ve: chua co ton thi bao loi; nhap kho xong thi giu hang
select throws_like($$ select mark_preorder_arrived((select id from preorders where customer_name = 'Lan')) $$,
  '%kho chỉ còn%', 'chua du ton khong ghi hang ve');
select confirm_purchase_receipt((save_purchase_receipt('{"store_id":"00000000-0000-0000-0000-00000000000a",
  "supplier_id":"00000000-0000-0000-0000-0000000000e1","receipt_date":"2026-10-10",
  "items":[{"product_id":"00000000-0000-0000-0000-0000000000c1","qty":3,"unit_cost":320000}]}') ->> 'id')::uuid, 0);
select lives_ok($$ select mark_preorder_arrived((select id from preorders where customer_name = 'Lan')) $$, 'hang ve');
select is((select qty_reserved from inventory where product_id = '00000000-0000-0000-0000-0000000000c1'), 2::numeric(12,3),
  'giu 2 hop cho don');

-- 3. Giao: phan con lai 600.000 chuyen khoan, giao dich ban kenh preorder, gia von binh quan kho
select tests.login(tests.uid('staff'));
select throws_like($$ select deliver_preorder((select id from preorders where customer_name = 'Lan'), '{}') $$,
  '%tài khoản nhận%', 'con no thi phai chon tai khoan');
select lives_ok($$ select deliver_preorder((select id from preorders where customer_name = 'Lan'),
  jsonb_build_object('account_id', '00000000-0000-0000-0000-0000000000f1')) $$, 'giao hang');
select tests.logout();
select is((select s.channel::text || ':' || s.total || ':' || s.cogs_total from sales s join preorders o on o.sale_id = s.id
  where o.customer_name = 'Lan'), 'preorder:900000:640000', 'ban kenh preorder, gia von 2 x 320.000');
select is((select string_agg(sp.method::text || '=' || sp.amount || ':' || coalesce(sp.account_id::text, '-'), ',' order by sp.method)
  from sale_payments sp join preorders o on o.sale_id = sp.sale_id where o.customer_name = 'Lan'),
  'transfer=600000:00000000-0000-0000-0000-0000000000f1,other=300000:-', 'tru coc + thu phan con lai');
select is((select qty_on_hand || ':' || qty_reserved from inventory where product_id = '00000000-0000-0000-0000-0000000000c1'),
  '1.000:0.000', 'tru kho va bo giu');
select is((select balance from money_account_balances() where id = '00000000-0000-0000-0000-0000000000f1'), 900000::bigint,
  'so du = coc + phan con lai, khong cong coc hai lan');

-- 4. Huy don co coc: nhan vien khong huy duoc; quan ly giu coc -> thu nhap khac, hoan coc -> tru so du
select tests.login(tests.uid('staff'));
select create_preorder(jsonb_build_object('store_id', tests.store('A'), 'customer_name', 'Minh', 'due_on', '2026-12-01',
  'deposit_type', 'amount', 'deposit_value', 50000, 'account_id', '00000000-0000-0000-0000-0000000000f1',
  'items', jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000c2', 'qty', 1))));
select create_preorder(jsonb_build_object('store_id', tests.store('A'), 'customer_name', 'Hoa', 'due_on', '2026-12-01',
  'deposit_type', 'amount', 'deposit_value', 40000, 'account_id', '00000000-0000-0000-0000-0000000000f1',
  'items', jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000c2', 'qty', 1))));
select throws_like($$ select cancel_preorder((select id from preorders where customer_name = 'Minh'),
  jsonb_build_object('reason', 'Khách đổi ý', 'deposit', 'keep')) $$, '%quản lý%', 'nhan vien khong huy don co coc');
select tests.login(tests.uid('admin'));
select cancel_preorder((select id from preorders where customer_name = 'Minh'),
  jsonb_build_object('reason', 'Khách đổi ý', 'deposit', 'keep', 'on', '2026-10-07'));
select is((select (pnl_report(array[tests.store('A')], '2026-10-07', '2026-10-07') ->> 'other_income')::bigint), 50000::bigint,
  'giu coc vao thu nhap khac');
select cancel_preorder((select id from preorders where customer_name = 'Hoa'),
  jsonb_build_object('reason', 'Hết hàng', 'deposit', 'refund', 'account_id', '00000000-0000-0000-0000-0000000000f1'));
select is((select balance from money_account_balances() where id = '00000000-0000-0000-0000-0000000000f1'), 950000::bigint,
  'so du: +50.000 giu coc, +40.000 - 40.000 hoan coc');
select is((select string_agg(status || ':' || coalesce(cancel_deposit, '-'), ',' order by customer_name) from preorders
  where status = 'cancelled'), 'cancelled:refund,cancelled:keep', 'trang thai huy va cach xu ly coc');

select * from finish();
rollback;
