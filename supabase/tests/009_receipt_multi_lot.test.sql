-- Nhap 1 san pham nhieu HSD trong cung 1 phieu: moi date -> 1 lo rieng, so lo tu dat.
begin;
-- @include setup.sql

select plan(6);

insert into suppliers (id, name, payment_terms_days) values ('00000000-0000-0000-0000-0000000000f1', 'NCC Lo', 0);
insert into products (id, name, unit, goods_type, expiry_level) values
  ('00000000-0000-0000-0000-0000000000d1', 'Bánh nhiều date', 'Hộp', 'air', 'lot');

-- Phieu: 1 san pham, 2 dong de trong so lo, 2 HSD khac nhau
select tests.login(tests.uid('admin'));
select lives_ok($$
  select save_purchase_receipt('{"store_id":"00000000-0000-0000-0000-00000000000a",
    "supplier_id":"00000000-0000-0000-0000-0000000000f1","receipt_date":"2026-09-20",
    "items":[
      {"product_id":"00000000-0000-0000-0000-0000000000d1","qty":10,"unit_cost":50000,"expiry_date":"2027-12-31"},
      {"product_id":"00000000-0000-0000-0000-0000000000d1","qty":10,"unit_cost":50000,"expiry_date":"2028-12-31"}
    ]}')
$$, 'tao phieu 1 san pham 2 date');

select lives_ok($$ select confirm_purchase_receipt((select id from purchase_receipts where store_id = tests.store('A') and status = 'draft')) $$,
  'xac nhan phieu 2 date');

select is((select count(*) from stock_lots where store_id = tests.store('A') and product_id = '00000000-0000-0000-0000-0000000000d1'),
  2::bigint, 'tao 2 lo rieng cho 2 date');

select is((select qty_on_hand from inventory where store_id = tests.store('A') and product_id = '00000000-0000-0000-0000-0000000000d1'),
  20::numeric, 'ton = 10 + 10');

-- So lo tu dat theo ma phieu: {ma phieu}-1 va {ma phieu}-2, dung HSD tuong ung
select is((select lot_no from stock_lots where store_id = tests.store('A')
    and product_id = '00000000-0000-0000-0000-0000000000d1' and expiry_date = '2027-12-31'),
  (select code || '-1' from purchase_receipts where store_id = tests.store('A')),
  'date 2027 -> lo {ma phieu}-1');
select is((select lot_no from stock_lots where store_id = tests.store('A')
    and product_id = '00000000-0000-0000-0000-0000000000d1' and expiry_date = '2028-12-31'),
  (select code || '-2' from purchase_receipts where store_id = tests.store('A')),
  'date 2028 -> lo {ma phieu}-2');

select * from finish();
rollback;
