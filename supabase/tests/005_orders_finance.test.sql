-- Sprint 4: don online giu hang, cong no, thu chi, PnL.
begin;
-- @include setup.sql

select plan(31);

insert into suppliers (id, name, payment_terms_days) values ('00000000-0000-0000-0000-0000000000e1', 'NCC Test', 0);
insert into products (id, name, unit, goods_type, sell_price, expiry_level) values
  ('00000000-0000-0000-0000-0000000000c1', 'Sữa A', 'Lon', 'cont', 100000, 'none');

select tests.login(tests.uid('admin'));
-- Nhap 2 lon gia 60.000, chua tra -> no 120.000
select confirm_purchase_receipt((save_purchase_receipt('{"store_id":"00000000-0000-0000-0000-00000000000a",
  "supplier_id":"00000000-0000-0000-0000-0000000000e1","receipt_date":"2026-09-01",
  "items":[{"product_id":"00000000-0000-0000-0000-0000000000c1","qty":2,"unit_cost":60000}]}') ->> 'id')::uuid, 0);

-- 1. Don Shopee giu 2 lon -> quay het hang (vi du SPEC F2.1)
select tests.login(tests.uid('staff'));
select lives_ok($$ select create_order('{"store_id":"00000000-0000-0000-0000-00000000000a","channel":"shopee",
  "external_order_id":"SP123","customer_name":"Chị Lan","shipping_fee":20000,"discount_amount":10000,"payment_method":"transfer",
  "items":[{"product_id":"00000000-0000-0000-0000-0000000000c1","qty":2,"unit_price":95000}]}') $$, 'tao don Shopee giu 2 lon');
select is((select qty_available from catalog_search(tests.store('A'), 'sua a')), 0::numeric, 'kha dung = 0 sau khi giu hang');
select open_shift(tests.store('A'), 0);
select throws_like($$ select complete_sale('{"store_id":"00000000-0000-0000-0000-00000000000a",
  "items":[{"product_id":"00000000-0000-0000-0000-0000000000c1","qty":1}],"payments":[{"method":"cash","amount":100000}]}') $$,
  '%chỉ còn 0%', 'POS bao het hang khi hang dang giu cho don online');
select throws_like($$ select create_order('{"store_id":"00000000-0000-0000-0000-00000000000a","channel":"shopee",
  "external_order_id":"SP123","items":[{"product_id":"00000000-0000-0000-0000-0000000000c1","qty":1}]}') $$,
  '%đã được nhập%', 'ma don san trung bi chan');
select is((select total from orders where external_order_id = 'SP123'), 200000::bigint, 'tong don = 190.000 + ship 20.000 - giam 10.000');
select is((select count(*) from reconcile_reservations(tests.store('A'))), 0::bigint, 'giu hang khop voi don dang mo');

-- 2. Giao thanh cong -> tao giao dich ban kenh Shopee
select lives_ok($$ select update_order_status((select id from orders where external_order_id = 'SP123'), 'shipped') $$, 'chuyen dang giao');
select lives_ok($$ select update_order_status((select id from orders where external_order_id = 'SP123'), 'delivered') $$, 'giao thanh cong');
select is((select channel::text from sales where order_id = (select id from orders where external_order_id = 'SP123')), 'shopee', 'giao dich ban kenh Shopee');
select is((select total from sales where order_id = (select id from orders where external_order_id = 'SP123')), 180000::bigint,
  'doanh thu = 190.000 - 10.000 (khong tinh phi ship)');
select tests.logout();
select is((select qty_on_hand from inventory where store_id = tests.store('A')), 0::numeric, 'ton thuc te tru khi giao');
select is((select qty_reserved from inventory where store_id = tests.store('A')), 0::numeric, 'bo giu hang khi giao');
select tests.login(tests.uid('staff'));
select throws_like($$ select update_order_status((select id from orders where external_order_id = 'SP123'), 'cancelled', 'x') $$,
  '%Không chuyển được%', 'don da giao khong huy duoc');

-- 3. Huy don dang giu -> tra kha dung
select tests.login(tests.uid('admin'));
select confirm_purchase_receipt((save_purchase_receipt('{"store_id":"00000000-0000-0000-0000-00000000000a",
  "supplier_id":"00000000-0000-0000-0000-0000000000e1","receipt_date":"2026-09-02",
  "items":[{"product_id":"00000000-0000-0000-0000-0000000000c1","qty":3,"unit_cost":60000}]}') ->> 'id')::uuid, 0);
select tests.login(tests.uid('staff'));
select lives_ok($$ select create_order('{"store_id":"00000000-0000-0000-0000-00000000000a","channel":"facebook",
  "items":[{"product_id":"00000000-0000-0000-0000-0000000000c1","qty":2}]}') $$, 'tao don Facebook giu 2');
select is((select qty_available from catalog_search(tests.store('A'), 'sua a')), 1::numeric, 'kha dung 1');
select throws_like($$ select update_order_status((select id from orders where channel = 'facebook'), 'cancelled') $$,
  '%lý do%', 'huy don phai co ly do');
select lives_ok($$ select update_order_status((select id from orders where channel = 'facebook'), 'cancelled', 'Khách hủy') $$, 'huy don');
select is((select qty_available from catalog_search(tests.store('A'), 'sua a')), 3::numeric, 'huy don tra kha dung ve 3');

-- 4. Cong no: 2 khoan (120.000 + 180.000), tra 200.000 phan bo cu truoc
select tests.login(tests.uid('staff'));
select throws_ok($$ select record_supplier_payment('{"store_id":"00000000-0000-0000-0000-00000000000a",
  "supplier_id":"00000000-0000-0000-0000-0000000000e1","amount":1000,"method":"cash"}') $$, 'P0001', null,
  'nhan vien khong thanh toan cong no');
select tests.login(tests.uid('acc'));
select throws_like($$ select record_supplier_payment('{"store_id":"00000000-0000-0000-0000-00000000000a",
  "supplier_id":"00000000-0000-0000-0000-0000000000e1","amount":999999,"method":"transfer"}') $$, '%vượt tổng còn nợ%',
  'tra vuot tong no bi chan');
select lives_ok($$ select record_supplier_payment('{"store_id":"00000000-0000-0000-0000-00000000000a",
  "supplier_id":"00000000-0000-0000-0000-0000000000e1","amount":200000,"method":"transfer"}') $$, 'ke toan tra 200.000');
select is((select status::text from supplier_debts where issued_date = '2026-09-01'), 'paid', 'khoan cu nhat tra du');
select is((select remaining from supplier_debts where issued_date = '2026-09-02'), 100000::bigint, 'khoan sau con 100.000');
select is((debt_overview(array[tests.store('A')]) ->> 'remaining'), '100000', 'tong quan: con no 100.000');

-- 5. Thu chi
select tests.login(tests.uid('staff'));
select throws_like($$ select create_cash_transaction(jsonb_build_object('store_id', tests.store('A'), 'kind', 'expense',
  'category_id', (select id from expense_categories where name = 'Điện'), 'description', 'Tiền điện', 'amount', 100000,
  'method', 'transfer')) $$, '%tiền mặt trong ca%', 'nhan vien khong ghi chi chuyen khoan');
select is((create_cash_transaction(jsonb_build_object('store_id', tests.store('A'), 'kind', 'expense',
  'category_id', (select id from expense_categories where name = 'Bao bì'), 'description', 'Mua túi', 'amount', 600000,
  'method', 'cash')) ->> 'approval_status'), 'pending', 'chi tien mat trong ca vuot 500.000: cho duyet');
select tests.login(tests.uid('acc'));
select lives_ok($$ select create_cash_transaction(jsonb_build_object('store_id', tests.store('A'), 'kind', 'expense',
  'category_id', (select id from expense_categories where name = 'Mặt bằng'), 'description', 'Thuê nhà', 'amount', 50000,
  'method', 'transfer', 'occurred_on', public._today())) $$, 'ke toan ghi chi phi mat bang');
select tests.login(tests.uid('admin'));
select lives_ok($$ select review_cash_transaction((select id from cash_transactions where description = 'Mua túi'), true) $$,
  'quan ly duyet khoan chi');

-- 6. PnL hom nay: doanh thu 190.000 - giam 10.000 = 180.000; COGS 120.000; chi 650.000
select is((pnl_report(array[tests.store('A')], public._today(), public._today()) ->> 'net_revenue'), '180000', 'PnL doanh thu thuan');
select is((pnl_report(array[tests.store('A')], public._today(), public._today()) ->> 'gross_profit'), '60000', 'PnL lai gop = 180.000 - 120.000');
select is((pnl_report(array[tests.store('A')], public._today(), public._today()) ->> 'net_profit'), '-590000', 'PnL lai rong = 60.000 - 650.000');

select * from finish();
rollback;
