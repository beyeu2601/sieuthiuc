-- Sprint 3: ca, ban hang (FEFO, gia tu DB, gioi han giam gia, PIN), huy, chot ca.
begin;
-- @include setup.sql

select plan(39);

insert into suppliers (id, name) values ('00000000-0000-0000-0000-0000000000e1', 'NCC Test');
insert into products (id, name, unit, goods_type, sell_price, expiry_level) values
  ('00000000-0000-0000-0000-0000000000c1', 'Sữa A', 'Lon', 'cont', 100000, 'lot');

-- Nhap 3 lo: E_OLD da het han 5, E1 han 2099-12-01 so luong 3, E2 han 2099-12-31 so luong 2
select tests.login(tests.uid('admin'));
select confirm_purchase_receipt((save_purchase_receipt('{"store_id":"00000000-0000-0000-0000-00000000000a",
  "supplier_id":"00000000-0000-0000-0000-0000000000e1",
  "items":[{"product_id":"00000000-0000-0000-0000-0000000000c1","qty":5,"unit_cost":60000,"lot_no":"E_OLD","expiry_date":"2020-01-01"},
           {"product_id":"00000000-0000-0000-0000-0000000000c1","qty":2,"unit_cost":60000,"lot_no":"E2","expiry_date":"2099-12-31"},
           {"product_id":"00000000-0000-0000-0000-0000000000c1","qty":3,"unit_cost":60000,"lot_no":"E1","expiry_date":"2099-12-01"}]}')
  ->> 'id')::uuid, 600000, 'transfer');

-- 1. Ca
select throws_like($$ select complete_sale('{"store_id":"00000000-0000-0000-0000-00000000000a",
  "items":[{"product_id":"00000000-0000-0000-0000-0000000000c1","qty":1}],"payments":[{"method":"cash","amount":100000}]}') $$,
  '%chưa mở ca%', 'chua mo ca thi khong ban duoc');
select tests.login(tests.uid('staff'));
select lives_ok($$ select open_shift('00000000-0000-0000-0000-00000000000a', 500000) $$, 'nhan vien mo ca 500.000');
select throws_like($$ select open_shift('00000000-0000-0000-0000-00000000000a', 0) $$, '%chưa chốt%', 'khong mo 2 ca cung luc');

-- 2. Ban hang FEFO
select is((complete_sale('{"store_id":"00000000-0000-0000-0000-00000000000a","idempotency_key":"k1",
  "items":[{"product_id":"00000000-0000-0000-0000-0000000000c1","qty":4,"unit_price":1}],
  "payments":[{"method":"cash","amount":400000}]}') ->> 'total'), '400000',
  'ban 4 lon: tong theo gia trong DB (bo qua gia gui len)');
select tests.logout();
select is((select qty_on_hand from stock_lots where lot_no = 'E1'), 0::numeric, 'FEFO: lo E1 (het han som hon) xuat het');
select is((select qty_on_hand from stock_lots where lot_no = 'E2'), 1::numeric, 'FEFO: lo E2 xuat 1');
select is((select qty_on_hand from stock_lots where lot_no = 'E_OLD'), 5::numeric, 'lo het han khong bi xuat');
select is((select qty_on_hand from inventory where store_id = tests.store('A')), 6::numeric, 'ton con 6');
select is((select count(*) from stock_movements where ref_type = 'sale'), 2::bigint, '2 dong bien dong (2 lo)');
select tests.login(tests.uid('staff'));
select is((complete_sale('{"store_id":"00000000-0000-0000-0000-00000000000a","idempotency_key":"k1",
  "items":[{"product_id":"00000000-0000-0000-0000-0000000000c1","qty":4}],
  "payments":[{"method":"cash","amount":400000}]}') ->> 'duplicate'), 'true', 'gui lai cung khoa: khong ban trung');
select throws_like($$ select complete_sale('{"store_id":"00000000-0000-0000-0000-00000000000a",
  "items":[{"product_id":"00000000-0000-0000-0000-0000000000c1","qty":2}],"payments":[{"method":"cash","amount":200000}]}') $$,
  '%hết hạn%', 'chi con lo het han: chan ban');
select throws_like($$ select complete_sale('{"store_id":"00000000-0000-0000-0000-00000000000a",
  "items":[{"product_id":"00000000-0000-0000-0000-0000000000c1","qty":99}],"payments":[{"method":"cash","amount":1}]}') $$,
  '%chỉ còn%', 'vuot ton: bao so con lai');
select throws_like($$ select complete_sale('{"store_id":"00000000-0000-0000-0000-00000000000a",
  "items":[{"product_id":"00000000-0000-0000-0000-0000000000c1","qty":1}],"payments":[{"method":"cash","amount":90000}]}') $$,
  '%khác tổng đơn%', 'thanh toan khong khop tong: chan');

-- 3. Gioi han giam gia 10% va PIN quan ly
select throws_like($$ select complete_sale('{"store_id":"00000000-0000-0000-0000-00000000000a",
  "items":[{"product_id":"00000000-0000-0000-0000-0000000000c1","qty":1}],"discount_amount":20000,
  "payments":[{"method":"cash","amount":80000}]}') $$, '%hạn mức%', 'nhan vien giam 20% bi chan');
select tests.login(tests.uid('admin'));
select lives_ok($$ select set_my_pin('2468') $$, 'quan ly dat PIN');
select tests.login(tests.uid('staff'));
select is(request_discount_approval(tests.store('A'), 't_admin', '0000') ->> 'ok', 'false', 'PIN sai lan 1');
select is(request_discount_approval(tests.store('A'), 't_admin', '1111') ->> 'ok', 'false', 'PIN sai lan 2');
select is(request_discount_approval(tests.store('A'), 't_admin', '2222') ->> 'ok', 'false', 'PIN sai lan 3');
select alike(request_discount_approval(tests.store('A'), 't_admin', '2468') ->> 'error', '%3 lần%',
  'sai 3 lan: khoa ca PIN dung');
select tests.logout();
delete from pin_attempts;
select tests.login(tests.uid('staff'));
create temp table appr as select (request_discount_approval(tests.store('A'), 't_admin', '2468') ->> 'approval_id')::uuid as id;
select isnt((select id from appr), null, 'PIN dung: cap ma duyet');
select is((complete_sale(jsonb_build_object('store_id', tests.store('A'), 'approval_id', (select id from appr),
  'items', '[{"product_id":"00000000-0000-0000-0000-0000000000c1","qty":1}]'::jsonb, 'discount_amount', 20000,
  'payments', '[{"method":"transfer","amount":80000}]'::jsonb)) ->> 'total'),
  '80000', 'co ma duyet: duoc giam 20%');
select tests.logout();
select isnt((select used_at from discount_approvals where id = (select id from appr)), null, 'ma duyet da dung, khong dung lai duoc');
select tests.login(tests.uid('staff'));
select is((select discount_approved_by from sales where total = 80000), tests.uid('admin'), 'ghi nhan nguoi duyet giam gia');

-- 4. Quyen doc gia von
select throws_ok($$ select cogs_total from sales limit 1 $$, '42501', null, 'nhan vien khong doc duoc gia von giao dich');
select lives_ok($$ select code, total from sales limit 1 $$, 'nhan vien doc duoc thong tin ban');

-- 5. Huy giao dich trong ca: tra ton ve dung lo
select lives_ok($$ select cancel_sale((select id from sales where total = 80000), 'Khách đổi ý') $$, 'nhan vien huy giao dich trong ca');
select tests.logout();
select is((select qty_on_hand from stock_lots where lot_no = 'E2'), 1::numeric, 'huy: tra ve lo da xuat (E2 da ve 1)');
select is((select qty_on_hand from inventory where store_id = tests.store('A')), 6::numeric, 'huy: ton tro lai 6');
select tests.login(tests.uid('staff'));
select throws_like($$ select cancel_sale((select id from sales where total = 80000), 'x') $$, '%không ở trạng thái%', 'huy 2 lan bi chan');

-- 6. Chot ca: ky vong = 500.000 + 400.000 tien mat
select is(shift_expected_cash((select id from shifts where user_id = tests.uid('staff'))), 900000::bigint, 'tien mat ky vong');
select throws_like($$ select close_shift((select id from shifts where user_id = tests.uid('staff')), 800000, '') $$,
  '%ghi chú%', 'lech tien ma khong ghi chu: chan');
select is((close_shift((select id from shifts where user_id = tests.uid('staff')), 800000, 'Thiếu tiền') ->> 'status'),
  'flagged', 'lech 100.000 > nguong 50.000: can kiem tra');
select is((select cash_diff from shifts where user_id = tests.uid('staff')), -100000::bigint, 'chenh lech -100.000');
select throws_like($$ select close_shift((select id from shifts where user_id = tests.uid('staff')), 900000, 'x') $$,
  '%đã được chốt%', 'chot 2 lan bi chan');
select throws_like($$ select cancel_sale((select id from sales where total = 400000), 'x') $$,
  '%ca đang mở%', 'ca da chot: nhan vien khong huy duoc');
select throws_like($$ select approve_shift((select id from shifts where user_id = tests.uid('staff'))) $$,
  '%quản lý%', 'nhan vien khong duyet duoc ca');
select tests.login(tests.uid('admin'));
select lives_ok($$ select approve_shift((select id from shifts where user_id = tests.uid('staff')), 'Đã kiểm tra') $$, 'quan ly duyet ca');
select is((select status::text from shifts where user_id = tests.uid('staff')), 'approved', 'ca da duyet');
select is((shift_summary((select id from shifts where user_id = tests.uid('staff'))) ->> 'sales_count'), '1',
  'tom tat ca: 1 giao dich hoan tat');

select * from finish();
rollback;
