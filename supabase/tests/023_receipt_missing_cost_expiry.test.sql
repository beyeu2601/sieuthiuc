-- Nhap kho khi chua co gia von / HSD, bo sung sau.
begin;
-- @include setup.sql

select plan(14);

insert into suppliers (id, name, payment_terms_days) values ('00000000-0000-0000-0000-0000000000f1', 'NCC Thiếu giá', 15);
insert into products (id, name, unit, goods_type, sell_price, expiry_level) values
  ('00000000-0000-0000-0000-0000000000d1', 'Hàng chưa giá', 'Hộp', 'air', 100000, 'lot'),
  ('00000000-0000-0000-0000-0000000000d2', 'Hàng có giá', 'Hộp', 'air', 50000, 'none');

select tests.login(tests.uid('admin'));

-- Phieu: d1 10 hop chua co gia, chua co HSD; d2 5 hop gia 20.000, tra ngay 100.000
select lives_ok($$ select save_purchase_receipt('{"store_id":"00000000-0000-0000-0000-00000000000a",
  "supplier_id":"00000000-0000-0000-0000-0000000000f1","receipt_date":"2026-10-17",
  "items":[{"product_id":"00000000-0000-0000-0000-0000000000d1","qty":10,"unit_cost":null},
           {"product_id":"00000000-0000-0000-0000-0000000000d2","qty":5,"unit_cost":20000}]}') $$,
  'luu phieu khi dong chua co gia von');
select lives_ok($$ select confirm_purchase_receipt((select id from purchase_receipts where receipt_date = '2026-10-17'),
  100000::bigint, 'transfer'::public.payment_method, null::date, false, null::uuid) $$,
  'nhap kho khi thieu gia von va HSD');
select is((select total from purchase_receipts where receipt_date = '2026-10-17'), 100000::bigint, 'tong phieu chi gom dong co gia');
select is((select qty_on_hand from inventory where product_id = '00000000-0000-0000-0000-0000000000d1'), 10::numeric, 'hang chua gia van vao kho');
select is((select count(*) from supplier_debts where receipt_id = (select id from purchase_receipts where receipt_date = '2026-10-17')),
  0::bigint, 'da tra du phan co gia: chua co no');

-- Nhan vien khong bo sung
select tests.login(tests.uid('staff'));
select throws_ok($$ select complete_receipt_item((select i.id from purchase_receipt_items i
  where i.product_id = '00000000-0000-0000-0000-0000000000d1'), '{"unit_cost":30000}') $$,
  'P0001', null, 'nhan vien khong bo sung gia von');

-- Ban 4 hop truoc khi co gia (gia von 0)
select tests.login(tests.uid('admin'));
select open_shift(tests.store('A'), 0);
select complete_sale(jsonb_build_object('store_id', tests.store('A'), 'idempotency_key', 'k-miss',
  'items', jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000d1', 'qty', 4)),
  'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 400000))));

-- Bo sung gia 30.000 va HSD
select lives_ok($$ select complete_receipt_item((select i.id from purchase_receipt_items i
  where i.product_id = '00000000-0000-0000-0000-0000000000d1'), '{"unit_cost":30000,"expiry_date":"2027-01-31"}') $$,
  'admin bo sung gia von va HSD');
select is((select total from purchase_receipts where receipt_date = '2026-10-17'), 400000::bigint, 'tong phieu cong tien hang bo sung');
select is((select total_amount from supplier_debts where receipt_id = (select id from purchase_receipts where receipt_date = '2026-10-17')),
  300000::bigint, 'tao khoan no cho tien hang bo sung');
select is((select due_date from supplier_debts where receipt_id = (select id from purchase_receipts where receipt_date = '2026-10-17')),
  '2026-11-01'::date, 'han no theo so ngay duoc no');
select is((select avg_cost from inventory where product_id = '00000000-0000-0000-0000-0000000000d1'), 30000::bigint,
  'gia von binh quan cua 6 hop con ton');
select is((select expiry_date from stock_lots where product_id = '00000000-0000-0000-0000-0000000000d1'), '2027-01-31'::date,
  'HSD ghi vao lo');
select tests.logout();
select is((select cogs_total from sales where idempotency_key = 'k-miss'), 0::bigint, 'giao dich ban truoc giu gia von cu');
select tests.login(tests.uid('admin'));
select throws_ok($$ select complete_receipt_item((select i.id from purchase_receipt_items i
  where i.product_id = '00000000-0000-0000-0000-0000000000d1'), '{"unit_cost":1}') $$,
  'P0001', null, 'khong bo sung lan hai');

select * from finish();
rollback;
