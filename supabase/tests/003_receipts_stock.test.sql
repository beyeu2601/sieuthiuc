-- Sprint 2: phieu nhap, landed cost, WAVG, lo, cong no, chuyen kho, bao cao ton.
begin;
-- @include setup.sql

select plan(39);

insert into suppliers (id, name, payment_terms_days) values ('00000000-0000-0000-0000-0000000000e1', 'NCC Test', 30);
insert into products (id, name, unit, goods_type, expiry_level) values
  ('00000000-0000-0000-0000-0000000000c1', 'Sữa A', 'Lon', 'cont', 'lot'),
  ('00000000-0000-0000-0000-0000000000c2', 'Kem B', 'Hộp', 'air', 'none');

-- 1. Luu nhap: nhan vien tao duoc; draft khong doi ton
select tests.login(tests.uid('staff'));
select lives_ok($$
  select save_purchase_receipt('{"store_id":"00000000-0000-0000-0000-00000000000a",
    "supplier_id":"00000000-0000-0000-0000-0000000000e1","receipt_date":"2026-09-01",
    "items":[{"product_id":"00000000-0000-0000-0000-0000000000c1","qty":10,"unit_cost":100000,"expiry_date":"2027-06-30"}]}')
$$, 'nhan vien tao phieu nhap nhap');
select is((select status::text from purchase_receipts where store_id = tests.store('A')), 'draft', 'phieu o trang thai nhap');
select is((select count(*) from inventory where store_id = tests.store('A')), 0::bigint, 'phieu nhap chua doi ton');
select matches((select code from purchase_receipts where store_id = tests.store('A')), '^PN-TA-[0-9]{6}-0001$', 'ma phieu PN');
select throws_ok($$ select confirm_purchase_receipt((select id from purchase_receipts limit 1)) $$,
  'P0001', null, 'nhan vien khong co quyen xac nhan');
select throws_ok($$
  select save_purchase_receipt('{"store_id":"00000000-0000-0000-0000-00000000000b",
    "supplier_id":"00000000-0000-0000-0000-0000000000e1","items":[]}') $$,
  'P0001', null, 'nhan vien A khong tao phieu cho cua hang B');

-- 2. Xac nhan: ton, lo, WAVG, cong no
select tests.login(tests.uid('admin'));
select is((confirm_purchase_receipt((select id from purchase_receipts where store_id = tests.store('A')), 0) ->> 'code')
  is not null, true, 'admin xac nhan phieu 1');
select is((select qty_on_hand from inventory where store_id = tests.store('A') and product_id = '00000000-0000-0000-0000-0000000000c1'),
  10::numeric, 'ton = 10');
select is((select avg_cost from inventory where store_id = tests.store('A') and product_id = '00000000-0000-0000-0000-0000000000c1'),
  100000::bigint, 'gia von = 100.000');
select is((select total_amount from supplier_debts where store_id = tests.store('A')), 1000000::bigint, 'cong no = tong phieu');
select is((select due_date from supplier_debts where store_id = tests.store('A')), '2026-10-01'::date,
  'han no = ngay nhap + 30 ngay');
select throws_ok($$ select confirm_purchase_receipt((select id from purchase_receipts where store_id = tests.store('A') limit 1)) $$,
  'P0001', 'Phiếu đã được xác nhận', 'xac nhan 2 lan bi chan');
select throws_ok($$ select save_purchase_receipt(jsonb_build_object('id', (select id from purchase_receipts limit 1),
  'supplier_id', '00000000-0000-0000-0000-0000000000e1', 'items', '[]'::jsonb)) $$,
  'P0001', null, 'khong sua duoc phieu da xac nhan');

-- Phieu 2: 10 @ 120.000 -> WAVG 110.000 (test case SPEC F4.3); tra truoc 500.000
select is((select (save_purchase_receipt('{"store_id":"00000000-0000-0000-0000-00000000000a",
    "supplier_id":"00000000-0000-0000-0000-0000000000e1","receipt_date":"2026-09-10",
    "items":[{"product_id":"00000000-0000-0000-0000-0000000000c1","qty":10,"unit_cost":120000,"lot_no":"L2","expiry_date":"2027-03-31"}]}')
  ->> 'code') is not null), true, 'tao phieu 2');
select lives_ok($$ select confirm_purchase_receipt((select id from purchase_receipts where status = 'draft'), 500000, 'transfer') $$,
  'xac nhan phieu 2 co tra truoc');
select is((select avg_cost from inventory where store_id = tests.store('A') and product_id = '00000000-0000-0000-0000-0000000000c1'),
  110000::bigint, 'WAVG: 10@100k + 10@120k = 110k');
select is((select cost_price_ref from products where id = '00000000-0000-0000-0000-0000000000c1'), 110000::bigint,
  'gia von tham chieu san pham cap nhat');
select is((select count(*) from stock_lots where store_id = tests.store('A') and product_id = '00000000-0000-0000-0000-0000000000c1'),
  2::bigint, 'moi phieu 1 lo');
select is((select remaining from supplier_debts where receipt_id = (select id from purchase_receipts where code like '%0002')),
  700000::bigint, 'con no = 1.200.000 - 500.000');
select is((select status::text from supplier_debts where receipt_id = (select id from purchase_receipts where code like '%0002')),
  'partial', 'trang thai no: tra mot phan');
select is((select sum(qty_delta) from stock_movements where store_id = tests.store('A') and product_id = '00000000-0000-0000-0000-0000000000c1'),
  (select qty_on_hand from inventory where store_id = tests.store('A') and product_id = '00000000-0000-0000-0000-0000000000c1'),
  'ton = tong bien dong');

-- 3. Landed cost: 2 dong, phi 100.001 theo gia tri, phan du vao dong cuoi
select lives_ok($$ select save_purchase_receipt('{"store_id":"00000000-0000-0000-0000-00000000000a",
    "supplier_id":"00000000-0000-0000-0000-0000000000e1","receipt_date":"2026-09-15",
    "items":[{"product_id":"00000000-0000-0000-0000-0000000000c1","qty":3,"unit_cost":100000,"lot_no":"L3","expiry_date":"2027-01-31"},
             {"product_id":"00000000-0000-0000-0000-0000000000c2","qty":1,"unit_cost":100000}],
    "costs":[{"cost_type":"shipping","amount":100001,"allocation":"by_value"}]}') $$, 'tao phieu co chi phi kem');
select throws_like($$ select confirm_purchase_receipt((select id from purchase_receipts where status = 'draft'), 999999999, 'cash') $$,
  '%từ 0 đến tổng tiền%', 'tra vuot tong bi chan');
select lives_ok($$ select confirm_purchase_receipt((select id from purchase_receipts where status = 'draft'), 500001, 'cash') $$,
  'xac nhan phieu 3, tra du');
select is((select sum(allocated_cost)::bigint from purchase_receipt_items where receipt_id = (select id from purchase_receipts where code like '%0003')),
  100001::bigint, 'tong phan bo = tong chi phi');
select is((select landed_unit_cost from purchase_receipt_items
  where receipt_id = (select id from purchase_receipts where code like '%0003') and line_no = 1), 125000::bigint,
  'gia von nhap dong 1 = 100.000 + 75.000/3');
select is((select count(*) from supplier_debts where receipt_id = (select id from purchase_receipts where code like '%0003')),
  0::bigint, 'tra du: khong tao cong no');
select is((select amount from supplier_payments where receipt_id = (select id from purchase_receipts where code like '%0003')),
  500001::bigint, 'tra du: ghi 1 khoan thanh toan');

-- HSD bat buoc voi san pham quan ly theo lo
select lives_ok($$ select save_purchase_receipt('{"store_id":"00000000-0000-0000-0000-00000000000a",
    "supplier_id":"00000000-0000-0000-0000-0000000000e1",
    "items":[{"product_id":"00000000-0000-0000-0000-0000000000c1","qty":1,"unit_cost":1}]}') $$, 'tao phieu thieu HSD');
select throws_like($$ select confirm_purchase_receipt((select id from purchase_receipts where status = 'draft')) $$,
  '%hạn sử dụng%', 'xac nhan phieu thieu HSD bi chan');
select lives_ok($$ select cancel_purchase_receipt((select id from purchase_receipts where status = 'draft'), 'Nhập sai') $$,
  'huy phieu nhap');

-- 4. Doc ton: nhan vien khong thay gia von
select tests.login(tests.uid('staff'));
select is((select avg_cost from inventory_status(tests.store('A'), 'sua a')), null::bigint, 'nhan vien: gia von an');
select is((select qty_available from inventory_status(tests.store('A'), 'sua a')), 23::numeric, 'nhan vien: thay ton kha dung');
select is((select count(*) from lot_expiry(tests.store('A'))), 4::bigint, 'nhan vien xem duoc lo va han');
select is((select unit_cost from lot_expiry(tests.store('A')) limit 1), null::bigint, 'nhan vien: gia lo an');

-- 5. Chuyen kho A -> B: tong ton khong doi, gia von theo WAVG cua A
select tests.login(tests.uid('sadmin'));
select lives_ok($$ select send_transfer((save_transfer(jsonb_build_object(
  'from_store_id', '00000000-0000-0000-0000-00000000000a', 'to_store_id', '00000000-0000-0000-0000-00000000000b',
  'items', jsonb_build_array(jsonb_build_object('lot_id',
     (select id from stock_lots where store_id = '00000000-0000-0000-0000-00000000000a' and lot_no = 'L2'), 'qty', 4))))
  ->> 'id')::uuid) $$, 'gui chuyen kho 4 lon');
select is((select qty_on_hand from inventory where store_id = tests.store('A') and product_id = '00000000-0000-0000-0000-0000000000c1'),
  19::numeric, 'cua hang A giam 4 khi gui');
select lives_ok($$ select receive_transfer((select id from stock_transfers limit 1)) $$, 'cua hang B nhan');
select is((select avg_cost from inventory where store_id = tests.store('B') and product_id = '00000000-0000-0000-0000-0000000000c1'),
  (select avg_cost from inventory where store_id = tests.store('A') and product_id = '00000000-0000-0000-0000-0000000000c1'),
  'gia von cua hang nhan = gia von binh quan cua hang gui');

select * from finish();
rollback;
