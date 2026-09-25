-- Sprint 1: san pham, gia % Benefit, barcode, tra cuu, nha cung cap, import danh muc.
begin;
-- @include setup.sql

select plan(31);

-- Nhom hang co % benefit
insert into categories (id, name, benefit_pct) values ('00000000-0000-0000-0000-0000000000d1', 'Sữa', 25);

select is(search_text('Đường Sữa Bột'), 'duong sua bot', 'search_text bo dau va doi d');

-- 1. Gia theo % Benefit (SPEC 7.4)
select is(round_to(123456, 1000), 123000::bigint, 'round_to lam tron xuong');
select is(round_to(123500, 1000), 124000::bigint, 'round_to lam tron len');
select is(benefit_price(760000, 25), 950000::bigint, 'gia = von x (1 + 25%) lam tron 1000');
select is(benefit_price(0, 25), null::bigint, 'khong co gia von -> khong tinh gia');

select tests.login(tests.uid('admin'));
insert into products (id, name, unit, goods_type, category_id, pricing_method, cost_price_ref)
values ('00000000-0000-0000-0000-0000000000c1', 'Sữa Bột Ensure Úc 850g', 'Lon', 'cont',
        '00000000-0000-0000-0000-0000000000d1', 'benefit', 760000);
select is((select sell_price from products where id = '00000000-0000-0000-0000-0000000000c1'), 950000::bigint,
  'tao san pham benefit: gia tu tinh theo % cua nhom hang');
update products set benefit_pct = 30 where id = '00000000-0000-0000-0000-0000000000c1';
select is((select sell_price from products where id = '00000000-0000-0000-0000-0000000000c1'), 988000::bigint,
  'doi % benefit rieng: gia tinh lai (988.000)');
select is((select count(*) from price_history where product_id = '00000000-0000-0000-0000-0000000000c1' and field = 'sell_price'),
  1::bigint, 'doi gia ghi 1 dong lich su gia');

-- gia von doi (nhu sau nhap hang): khong tu doi gia, chi goi y
update products set cost_price_ref = 800000 where id = '00000000-0000-0000-0000-0000000000c1';
select is((select sell_price from products where id = '00000000-0000-0000-0000-0000000000c1'), 988000::bigint,
  'gia von doi khong tu doi gia ban');
select is((select suggested_price from price_suggestions() where product_id = '00000000-0000-0000-0000-0000000000c1'),
  1040000::bigint, 'goi y gia moi = 800.000 x 1,3');
select is(apply_price_suggestions(array['00000000-0000-0000-0000-0000000000c1'::uuid]), 1, 'ap dung goi y 1 san pham');
select is((select sell_price from products where id = '00000000-0000-0000-0000-0000000000c1'), 1040000::bigint,
  'gia sau khi ap dung goi y');
select is((select count(*) from price_suggestions()), 0::bigint, 'het goi y sau khi ap dung');

-- 2. Barcode
select is(ean13_check_digit('400638133393'), 1, 'checksum EAN-13 dung (4006381333931)');
select lives_ok($$ select add_product_barcode('00000000-0000-0000-0000-0000000000c1', '9300617000123', 'ean', 1, false) $$,
  'admin gan ma EAN');
select is((select is_primary from product_barcodes where barcode = '9300617000123'), true,
  'ma dau tien tu thanh ma chinh');
select throws_ok($$ select add_product_barcode('00000000-0000-0000-0000-0000000000c1', '9300617000123') $$,
  'P0001', null, 'ma vach trung bi chan');
select lives_ok($$ select add_product_barcode('00000000-0000-0000-0000-0000000000c1', '19300617000120', 'ean', 6, false) $$,
  'gan ma loc 6 don vi');
select matches(generate_internal_barcode('00000000-0000-0000-0000-0000000000c1'), '^2[0-9]{12}$',
  'ma noi bo EAN-13 bat dau bang 2');

-- 3. Tra cuu cho nhan vien (khong doc bang products)
select tests.login(tests.uid('staff'));
select is((select count(*) from products), 0::bigint, 'nhan vien khong doc truc tiep bang products (co gia von)');
select is((select name from catalog_search(tests.store('A'), 'sua bot ensure')), 'Sữa Bột Ensure Úc 850g',
  'tim khong dau ra dung san pham');
select is((select pack_qty from catalog_search(tests.store('A'), '19300617000120')), 6::numeric,
  'quet ma loc tra ve so luong quy doi 6');
select throws_ok($$ select * from catalog_search(tests.store('B'), 'sua') $$, 'P0001', null,
  'nhan vien A khong tra cuu duoc cua hang B');
select throws_ok($$ select generate_internal_barcode('00000000-0000-0000-0000-0000000000c1') $$, 'P0001', null,
  'nhan vien khong sinh duoc ma noi bo');
select throws_ok($$ select apply_price_suggestions(array[]::uuid[]) $$, 'P0001', null,
  'nhan vien khong ap dung duoc goi y gia');

-- 4. Nha cung cap
select tests.login(tests.uid('acc'));
select lives_ok($$ insert into suppliers (name, payment_terms_days) values ('Công ty A', 30) $$, 'ke toan tao duoc NCC');
select matches((select code from suppliers where name = 'Công ty A'), '^NCC-[0-9]{4}$', 'ma NCC tu sinh');
select tests.login(tests.uid('staff'));
select throws_ok($$ insert into suppliers (name) values ('X') $$, '42501', null, 'nhan vien khong tao duoc NCC');

-- 5. Import danh muc
select tests.login(tests.uid('admin'));
select is((import_products('[
  {"row":2,"name":"Kem A","unit":"Hộp","goods_type":"air","sell_price":100000,"category":"Mỹ phẩm","barcode":"8850000000011"},
  {"row":3,"name":"Kem B","unit":"Hộp","goods_type":"cont","sell_price":120000,"category":"Mỹ phẩm"}]') ->> 'products'),
  '2', 'import 2 san pham, tao nhom hang moi');
select throws_like($$ select import_products('[{"row":7,"name":"X","unit":"Hộp","goods_type":"sea"}]') $$,
  'Dòng 7:%', 'loi import chi ro so dong');

-- 6. Hang thanh vien: admin sua duoc
update member_tiers set min_total_spent = 6000000 where name = 'Bạc';
select is((select min_total_spent from member_tiers where name = 'Bạc'), 6000000::bigint, 'admin sua duoc nguong hang');

select * from finish();
rollback;
