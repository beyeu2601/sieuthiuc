-- Can date: nguong theo loai date san pham (short/long) va gia ban de xuat = gia von lo + phu thu.
begin;
-- @include setup.sql

select plan(13);

-- San pham: date ngan, date dai, va mot san pham khong khai bao (mac dinh long)
insert into products (id, name, unit, goods_type, expiry_level, date_type) values
  ('00000000-0000-0000-0000-0000000000f1', 'Hang date ngan', 'Hop', 'cont', 'lot', 'short'),
  ('00000000-0000-0000-0000-0000000000f2', 'Hang date dai', 'Hop', 'cont', 'lot', 'long');
insert into products (id, name, unit, goods_type) values
  ('00000000-0000-0000-0000-0000000000f3', 'Hang mac dinh', 'Hop', 'cont');

-- Lo: han tinh tuong doi so voi hom nay
insert into stock_lots (store_id, product_id, lot_no, expiry_date, qty_on_hand, unit_cost) values
  (tests.store('A'), '00000000-0000-0000-0000-0000000000f1', 'S10', public._today() + 10, 5, 100000),  -- short, con 10 <= 15 -> near
  (tests.store('A'), '00000000-0000-0000-0000-0000000000f1', 'S40', public._today() + 40, 5, 100000),  -- short, con 40 > 15 -> normal
  (tests.store('A'), '00000000-0000-0000-0000-0000000000f2', 'L40', public._today() + 40, 5, 100000),  -- long, con 40 <= 60 -> near
  (tests.store('A'), '00000000-0000-0000-0000-0000000000f2', 'L90', public._today() + 90, 5, 100000);  -- long, con 90 > 60 -> normal

-- 1. Mac dinh loai date la 'long'
select is((select date_type::text from products where id = '00000000-0000-0000-0000-0000000000f3'), 'long',
  'san pham khong khai bao thi mac dinh date dai');

select tests.login(tests.uid('sadmin'));

-- 2-3. Nguong tra ve dung theo loai date
select is((select near_days from lot_expiry(tests.store('A'), 'near') where lot_no = 'S10'), 15,
  'date ngan dung nguong 15 ngay');
select is((select near_days from lot_expiry(tests.store('A'), 'near') where lot_no = 'L40'), 60,
  'date dai dung nguong 60 ngay');

-- 4-5. Gia ban de xuat = gia von lo + phu thu (100.000 + 50.000)
select is((select suggested_price from lot_expiry(tests.store('A'), 'near') where lot_no = 'S10'), 150000::bigint,
  'gia de xuat date ngan = gia von + 50.000');
select is((select suggested_price from lot_expiry(tests.store('A'), 'near') where lot_no = 'L40'), 150000::bigint,
  'gia de xuat date dai = gia von + 50.000');

-- 6. Loc near: chi 2 lo trong nguong (S10, L40)
select is((select count(*) from lot_expiry(tests.store('A'), 'near')), 2::bigint,
  'near chi gom lo trong nguong theo loai date');

-- 7-9. Danh sach day du va trang thai
select is((select count(*) from lot_expiry(tests.store('A'))), 4::bigint, 'danh sach day du 4 lo');
select is((select expiry_status from lot_expiry(tests.store('A')) where lot_no = 'S40'), 'normal',
  'date ngan con 40 ngay: chua can date');
select is((select expiry_status from lot_expiry(tests.store('A')) where lot_no = 'L90'), 'normal',
  'date dai con 90 ngay: chua can date');

-- 10-11. Nhan vien: an gia von va gia de xuat
select tests.login(tests.uid('staff'));
select is((select suggested_price from lot_expiry(tests.store('A'), 'near') where lot_no = 'S10'), null::bigint,
  'nhan vien: gia de xuat an');
select is((select unit_cost from lot_expiry(tests.store('A'), 'near') where lot_no = 'S10'), null::bigint,
  'nhan vien: gia von an');

-- 12. sadmin chinh nguong date ngan len 45 -> S40 thanh can date (near = 3)
select tests.login(tests.uid('sadmin'));
select set_setting('expiry.short_date_days', null, '45'::jsonb);
select is((select count(*) from lot_expiry(tests.store('A'), 'near')), 3::bigint,
  'doi nguong date ngan 45 ngay thi them lo S40 vao near');

-- 13. sadmin chinh phu thu len 70.000 -> gia de xuat S10 = 170.000
select set_setting('expiry.markup_vnd', null, '70000'::jsonb);
select is((select suggested_price from lot_expiry(tests.store('A'), 'near') where lot_no = 'S10'), 170000::bigint,
  'doi phu thu thi gia de xuat cap nhat');

select * from finish();
rollback;
