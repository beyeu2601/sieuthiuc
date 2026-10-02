-- Xoa san pham: chi sadmin/admin, chi khi chua co chung tu va het ton.
begin;
-- @include setup.sql

select plan(10);

insert into products (id, name, unit, goods_type, sell_price) values
  ('00000000-0000-0000-0000-0000000000d1', 'San pham sach', 'Hop', 'air', 100000),
  ('00000000-0000-0000-0000-0000000000d2', 'San pham con ton', 'Hop', 'air', 100000),
  ('00000000-0000-0000-0000-0000000000d3', 'San pham co ma vach', 'Hop', 'air', 100000),
  ('00000000-0000-0000-0000-0000000000d4', 'San pham da ve 0', 'Hop', 'air', 100000);
insert into product_barcodes (product_id, barcode, type, is_primary)
values ('00000000-0000-0000-0000-0000000000d3', '8930000000999', 'ean', true);

select tests.login(tests.uid('admin'));
select adjust_product_stock(tests.store('A'), '00000000-0000-0000-0000-0000000000d2', 5, 40000);
select adjust_product_stock(tests.store('A'), '00000000-0000-0000-0000-0000000000d4', 3, 40000);
select adjust_product_stock(tests.store('A'), '00000000-0000-0000-0000-0000000000d4', 0, null);

select lives_ok($$ select delete_product('00000000-0000-0000-0000-0000000000d1') $$, 'admin xoa san pham chua phat sinh');
select is((select count(*) from products where id = '00000000-0000-0000-0000-0000000000d1'), 0::bigint, 'san pham da bi xoa');

select lives_ok($$ select delete_product('00000000-0000-0000-0000-0000000000d3') $$, 'xoa duoc san pham co ma vach');
select is((select count(*) from product_barcodes where barcode = '8930000000999'), 0::bigint, 'ma vach bi xoa theo');

select throws_ok($$ select delete_product('00000000-0000-0000-0000-0000000000d2') $$, 'P0001', null, 'con ton thi khong xoa');

select lives_ok($$ select delete_product('00000000-0000-0000-0000-0000000000d4') $$, 'ton da ve 0 thi xoa duoc, ke ca co lich su bien dong');
select is((select count(*) from stock_movements where product_id = '00000000-0000-0000-0000-0000000000d4'), 0::bigint, 'bien dong kho bi xoa theo');

select throws_ok($$ select delete_product('00000000-0000-0000-0000-0000000000d1') $$, 'P0001', 'Không tìm thấy sản phẩm', 'san pham khong con');

select tests.login(tests.uid('staff'));
select throws_ok($$ select delete_product('00000000-0000-0000-0000-0000000000d2') $$, 'P0001', null, 'nhan vien khong xoa');

select tests.login(tests.uid('acc'));
select throws_ok($$ select delete_product('00000000-0000-0000-0000-0000000000d2') $$, 'P0001', null, 'ke toan khong xoa');

select * from finish();
rollback;
