-- Sap lai nhom hang san pham va bo nhom "Thuc Pham" (khach yeu cau 02/10/2026).
-- Nhom "Thuc Pham" chung chung, trung voi "Thuc Pham Kho": chuyen het sang "Thuc Pham Kho",
-- tru vai mon thuc chat la sua, TPCN hoac hang lanh. Sua them vai mon an uong nam nham o "Hang tieu dung".
-- "Hang tieu dung" la nhom giu lai sau lan gop 20261011000001 nhung dang tat, bat lai de chon duoc khi tao san pham.
-- Theo ten de chay duoc ca tren DB test; nhom khong ton tai thi bo qua.
do $$
declare
  m record;
  v_target uuid;
  v_food uuid;
begin
  for m in select * from (values
    ('Sữa bò non Healthy Care 300g', 'Sữa'),
    ('Nước Điện Giải Vị Táo & Lý Chua Đen', 'Thực Phẩm Chức Năng'),
    ('Nước Điện Giải Hydralyte Vị Cam', 'Thực Phẩm Chức Năng'),
    ('Macro Organic Psyllium 250g', 'Thực Phẩm Chức Năng'),
    ('Bơ Ô Liu Nuttelex 500g', 'Hàng Đông Lạnh'),
    ('Dầu Ô Liu Hữu Cơ Macro 500ml', 'Thực Phẩm Khô'),
    ('Thạch rau câu trái banh 900g', 'Thực Phẩm Khô'),
    ('Bánh ăn dặm vị chuối Rafferty''s 12M+', 'Thực Phẩm Khô')
  ) as t(product_name, category_name)
  loop
    select id into v_target from public.categories where name = m.category_name;
    if v_target is not null then
      update public.products set category_id = v_target where name = m.product_name;
    end if;
  end loop;

  select id into v_food from public.categories where name = 'Thực Phẩm';
  select id into v_target from public.categories where name = 'Thực Phẩm Khô';
  if v_food is not null and v_target is not null then
    update public.products set category_id = v_target where category_id = v_food;
    delete from public.categories where id = v_food;
  end if;

  update public.categories set is_active = true where name = 'Hàng tiêu dùng';
end $$;
