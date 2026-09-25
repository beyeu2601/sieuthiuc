-- Anh san pham: toi da 10 anh, mot anh dai dien, quyen ghi sadmin/admin.
begin;
-- @include setup.sql

select plan(12);

select tests.login(tests.uid('admin'));
insert into products (id, name, unit, goods_type, sell_price)
values ('00000000-0000-0000-0000-0000000000c1', 'Kem Úc', 'Hộp', 'air', 100000);

select lives_ok($$ select add_product_image('00000000-0000-0000-0000-0000000000c1', 'f1', 't1') $$, 'admin them anh');
select is((select is_thumbnail from product_images where drive_file_id = 'f1'), true, 'anh dau tien la anh dai dien');
select add_product_image('00000000-0000-0000-0000-0000000000c1', 'f' || g, 't' || g) from generate_series(2, 10) g;
select is((select count(*) from product_images where is_thumbnail), 1::bigint, 'chi mot anh dai dien');
select throws_ok($$ select add_product_image('00000000-0000-0000-0000-0000000000c1', 'f11', 't11') $$,
  'P0001', 'Mỗi sản phẩm tối đa 10 ảnh', 'anh thu 11 bi chan');

select set_product_thumbnail((select id from product_images where drive_file_id = 'f5'));
select is((select drive_file_id from product_images where is_thumbnail), 'f5', 'doi anh dai dien');

select is((select drive_thumb_id from delete_product_image((select id from product_images where drive_file_id = 'f5'))),
  't5', 'xoa anh tra ve ma file de bo thung rac');
select is((select drive_file_id from product_images where is_thumbnail), 'f1', 'xoa anh dai dien: anh dau tien thay the');
select is((select count(*) from product_images), 9::bigint, 'con 9 anh');

select tests.login(tests.uid('staff'));
select is((select count(*) from product_images), 9::bigint, 'nhan vien xem duoc anh');
select throws_ok($$ select add_product_image('00000000-0000-0000-0000-0000000000c1', 'x', 'y') $$,
  'P0001', null, 'nhan vien khong them anh');
select throws_ok($$ insert into product_images (product_id, drive_file_id, drive_thumb_id)
  values ('00000000-0000-0000-0000-0000000000c1', 'x', 'y') $$, '42501', null, 'khong ghi thang vao bang');

select tests.login(tests.uid('acc'));
select throws_ok($$ select set_product_thumbnail((select id from product_images limit 1)) $$,
  'P0001', null, 'ke toan khong doi anh dai dien');

select * from finish();
rollback;
