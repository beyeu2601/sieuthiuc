-- Chiet khau phieu nhap (luc nhap va sau xac nhan), no dau ky NCC.
begin;
-- @include setup.sql

select plan(17);

insert into suppliers (id, name, payment_terms_days) values ('00000000-0000-0000-0000-0000000000f1', 'NCC Chiết khấu', 30);
insert into products (id, name, unit, goods_type, expiry_level) values
  ('00000000-0000-0000-0000-0000000000d1', 'Dầu CK', 'Chai', 'cont', 'none'),
  ('00000000-0000-0000-0000-0000000000d2', 'Dầu trả ngay', 'Chai', 'cont', 'none');

select tests.login(tests.uid('admin'));

-- (1) Phieu nhap co chiet khau: 36 x 86.667 = 3.120.012, thuong 165.012 => tong 2.955.000
select save_purchase_receipt('{"store_id":"00000000-0000-0000-0000-00000000000a",
  "supplier_id":"00000000-0000-0000-0000-0000000000f1","receipt_date":"2026-10-05",
  "discount_amount":165012,"discount_note":"Thưởng chương trình",
  "items":[{"product_id":"00000000-0000-0000-0000-0000000000d1","qty":36,"unit_cost":86667}]}');
select is((select total from purchase_receipts where receipt_date = '2026-10-05'), 2955000::bigint, 'tong phieu tru chiet khau');
select throws_ok($$ select save_purchase_receipt('{"store_id":"00000000-0000-0000-0000-00000000000a",
  "supplier_id":"00000000-0000-0000-0000-0000000000f1","discount_amount":999999999,
  "items":[{"product_id":"00000000-0000-0000-0000-0000000000d1","qty":1,"unit_cost":1000}]}') $$,
  'P0001', null, 'chiet khau lon hon tien hang bi tu choi');
select confirm_purchase_receipt((select id from purchase_receipts where receipt_date = '2026-10-05'));
select is((select landed_unit_cost from purchase_receipt_items i join purchase_receipts r on r.id = i.receipt_id where r.receipt_date = '2026-10-05'),
  82083::bigint, 'gia von dong = (tien hang - chiet khau) / SL');
select is((select total_amount from supplier_debts where receipt_id = (select id from purchase_receipts where receipt_date = '2026-10-05')),
  2955000::bigint, 'cong no bang tong sau chiet khau');

-- (2a) Chiet khau sau xac nhan, phieu con no: giam no
select lives_ok($$ select add_receipt_discount((select id from purchase_receipts where receipt_date = '2026-10-05'), 5000, 'Thưởng thêm') $$,
  'ghi chiet khau sau cho phieu con no');
select is((select total_amount from supplier_debts where receipt_id = (select id from purchase_receipts where receipt_date = '2026-10-05')),
  2950000::bigint, 'no giam theo chiet khau');
select is((select total from purchase_receipts where receipt_date = '2026-10-05'), 2950000::bigint, 'tong phieu giam theo chiet khau');

-- (2b) Phieu da tra ngay khi nhap (chuyen khoan): giam khoan tra
select save_purchase_receipt('{"store_id":"00000000-0000-0000-0000-00000000000a",
  "supplier_id":"00000000-0000-0000-0000-0000000000f1","receipt_date":"2026-10-02",
  "items":[{"product_id":"00000000-0000-0000-0000-0000000000d2","qty":60,"unit_cost":88000}]}');
select confirm_purchase_receipt((select id from purchase_receipts where receipt_date = '2026-10-02'),
  5280000::bigint, 'transfer'::public.payment_method, null::date, false, null::uuid);
select lives_ok($$ select add_receipt_discount((select id from purchase_receipts where receipt_date = '2026-10-02'), 280000, 'Thưởng chương trình') $$,
  'ghi chiet khau sau cho phieu da tra khi nhap');
select is((select amount from supplier_payments where receipt_id = (select id from purchase_receipts where receipt_date = '2026-10-02')),
  5000000::bigint, 'khoan tra khi nhap giam theo chiet khau');
select is((select paid_amount from purchase_receipts where receipt_date = '2026-10-02'), 5000000::bigint, 'so da tra cua phieu giam');
select is((select count(*) from supplier_debts where receipt_id = (select id from purchase_receipts where receipt_date = '2026-10-02')),
  0::bigint, 'khong sinh cong no');
select throws_ok($$ select add_receipt_discount((select id from purchase_receipts where receipt_date = '2026-10-02'), 6000000, 'Sai') $$,
  'P0001', null, 'chiet khau khong vuot so da tra');

-- Nhan vien khong ghi chiet khau sau
select tests.login(tests.uid('staff'));
select throws_ok($$ select add_receipt_discount((select id from purchase_receipts where receipt_date = '2026-10-02'), 1000, 'x') $$,
  'P0001', null, 'nhan vien khong ghi chiet khau sau');

-- (3) No dau ky: ke toan ghi, tra qua cong no, khong xoa duoc khi da tra
select tests.login(tests.uid('acc'));
select lives_ok($$ select create_supplier_opening_debt('{"store_id":"00000000-0000-0000-0000-00000000000a",
  "supplier_id":"00000000-0000-0000-0000-0000000000f1","amount":1000000,"issued_date":"2026-09-20"}') $$,
  'ke toan ghi no dau ky');
select is((select due_date from supplier_debts where receipt_id is null and supplier_id = '00000000-0000-0000-0000-0000000000f1'),
  '2026-10-20'::date, 'han tra theo so ngay duoc no cua NCC');
select record_supplier_payment(jsonb_build_object('store_id', tests.store('A'), 'supplier_id', '00000000-0000-0000-0000-0000000000f1',
  'amount', 400000, 'method', 'transfer',
  'allocations', jsonb_build_array(jsonb_build_object('debt_id',
    (select id from supplier_debts where receipt_id is null and supplier_id = '00000000-0000-0000-0000-0000000000f1'), 'amount', 400000))));
select is((select remaining from supplier_debts where receipt_id is null and supplier_id = '00000000-0000-0000-0000-0000000000f1'),
  600000::bigint, 'tra mot phan no dau ky');
select throws_ok($$ select delete_supplier_opening_debt((select id from supplier_debts where receipt_id is null
    and supplier_id = '00000000-0000-0000-0000-0000000000f1')) $$,
  'P0001', null, 'khong xoa no dau ky da tra');

select * from finish();
rollback;
