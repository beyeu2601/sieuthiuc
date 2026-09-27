-- Mo lai phieu nhap da xac nhan (reopen_purchase_receipt): dao nguoc sach se roi cho sua lai.
begin;
-- @include setup.sql

select plan(15);

insert into suppliers (id, name, payment_terms_days) values ('00000000-0000-0000-0000-0000000000f1', 'NCC Reopen', 0);
insert into products (id, name, unit, goods_type, expiry_level) values
  ('00000000-0000-0000-0000-0000000000d1', 'Hàng mở lại', 'Hộp', 'air', 'none'),
  ('00000000-0000-0000-0000-0000000000d2', 'Hàng đã trả', 'Hộp', 'air', 'none'),
  ('00000000-0000-0000-0000-0000000000d3', 'Hàng có biến động', 'Hộp', 'air', 'none');

select tests.login(tests.uid('admin'));

-- R1: phieu sach, xac nhan khong thanh toan
select save_purchase_receipt('{"store_id":"00000000-0000-0000-0000-00000000000a",
  "supplier_id":"00000000-0000-0000-0000-0000000000f1","receipt_date":"2026-09-20",
  "items":[{"product_id":"00000000-0000-0000-0000-0000000000d1","qty":10,"unit_cost":50000}]}');
select confirm_purchase_receipt((select id from purchase_receipts where store_id = tests.store('A') and status = 'draft'));

select is((select qty_on_hand from inventory where store_id = tests.store('A') and product_id = '00000000-0000-0000-0000-0000000000d1'),
  10::numeric, 'sau xac nhan: ton = 10');
select is((select avg_cost from inventory where store_id = tests.store('A') and product_id = '00000000-0000-0000-0000-0000000000d1'),
  50000::bigint, 'sau xac nhan: gia von binh quan = 50000');
select is((select count(*) from stock_lots where product_id = '00000000-0000-0000-0000-0000000000d1'),
  1::bigint, 'sau xac nhan: 1 lo');
select is((select count(*) from supplier_debts where receipt_id = (select id from purchase_receipts where store_id = tests.store('A') and status = 'confirmed')),
  1::bigint, 'sau xac nhan: 1 cong no');

-- Mo lai R1
select lives_ok($$ select reopen_purchase_receipt((select id from purchase_receipts where store_id = tests.store('A') and status = 'confirmed')) $$,
  'admin mo lai phieu sach');
select is((select status::text from purchase_receipts where store_id = tests.store('A')), 'draft',
  'sau mo lai: phieu ve nhap');
select is((select count(*) from stock_lots where product_id = '00000000-0000-0000-0000-0000000000d1'),
  0::bigint, 'sau mo lai: xoa lo');
select is((select qty_on_hand from inventory where store_id = tests.store('A') and product_id = '00000000-0000-0000-0000-0000000000d1'),
  0::numeric, 'sau mo lai: ton ve 0');
select is((select avg_cost from inventory where store_id = tests.store('A') and product_id = '00000000-0000-0000-0000-0000000000d1'),
  0::bigint, 'sau mo lai: gia von ve 0');
select is((select count(*) from supplier_debts where receipt_id = (select id from purchase_receipts where store_id = tests.store('A'))),
  0::bigint, 'sau mo lai: xoa cong no');

-- Sua roi xac nhan lai: doi so luong 10 -> 8
select save_purchase_receipt(('{"id":"' || (select id from purchase_receipts where store_id = tests.store('A')) ||
  '","store_id":"00000000-0000-0000-0000-00000000000a","supplier_id":"00000000-0000-0000-0000-0000000000f1",
  "receipt_date":"2026-09-20","items":[{"product_id":"00000000-0000-0000-0000-0000000000d1","qty":8,"unit_cost":50000}]}')::jsonb);
select lives_ok($$ select confirm_purchase_receipt((select id from purchase_receipts where store_id = tests.store('A') and status = 'draft')) $$,
  'xac nhan lai sau khi sua');
select is((select qty_on_hand from inventory where store_id = tests.store('A') and product_id = '00000000-0000-0000-0000-0000000000d1'),
  8::numeric, 'sau xac nhan lai: ton = 8 (da sua)');

-- R2: da thanh toan khi nhap -> tu choi mo lai
select save_purchase_receipt('{"store_id":"00000000-0000-0000-0000-00000000000a",
  "supplier_id":"00000000-0000-0000-0000-0000000000f1","receipt_date":"2026-09-21",
  "items":[{"product_id":"00000000-0000-0000-0000-0000000000d2","qty":5,"unit_cost":20000}]}');
select confirm_purchase_receipt((select id from purchase_receipts where store_id = tests.store('A') and status = 'draft'),
  100000::bigint, 'cash'::public.payment_method, null::date, false, null::uuid);
select throws_ok($$ select reopen_purchase_receipt((select id from purchase_receipts where store_id = tests.store('A') and status = 'confirmed'
    and supplier_id = '00000000-0000-0000-0000-0000000000f1' and receipt_date = '2026-09-21')) $$,
  'P0001', null, 'tu choi mo lai phieu da thanh toan');

-- R3: lo co bien dong khac -> tu choi mo lai
select save_purchase_receipt('{"store_id":"00000000-0000-0000-0000-00000000000a",
  "supplier_id":"00000000-0000-0000-0000-0000000000f1","receipt_date":"2026-09-22",
  "items":[{"product_id":"00000000-0000-0000-0000-0000000000d3","qty":8,"unit_cost":10000}]}');
select confirm_purchase_receipt((select id from purchase_receipts where store_id = tests.store('A') and status = 'draft'));
-- Chen 1 bien dong dieu chinh gia (khong doi so luong) len lo cua d3 (qua role postgres, RLS chi cho ghi qua RPC)
select tests.logout();
insert into stock_movements (store_id, product_id, lot_id, movement_type, qty_delta, qty_before, qty_after, unit_cost)
select tests.store('A'), '00000000-0000-0000-0000-0000000000d3', l.id, 'adjustment', 0, l.qty_on_hand, l.qty_on_hand, l.unit_cost
from stock_lots l where l.product_id = '00000000-0000-0000-0000-0000000000d3';
select tests.login(tests.uid('admin'));
select throws_ok($$ select reopen_purchase_receipt((select id from purchase_receipts where store_id = tests.store('A')
    and status = 'confirmed' and receipt_date = '2026-09-22')) $$,
  'P0001', null, 'tu choi mo lai phieu co bien dong khac tren lo');

-- Nhan vien khong duoc mo lai
select tests.login(tests.uid('staff'));
select throws_ok($$ select reopen_purchase_receipt((select id from purchase_receipts where store_id = tests.store('A')
    and status = 'confirmed' and receipt_date = '2026-09-22')) $$,
  'P0001', null, 'nhan vien khong duoc mo lai phieu');

select * from finish();
rollback;
