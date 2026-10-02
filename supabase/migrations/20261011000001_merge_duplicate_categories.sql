-- Gop nhom hang trung (khach yeu cau 02/10/2026):
-- TPCN -> Thuc Pham Chuc Nang; Hang Tieu Dung -> Hang tieu dung;
-- Hang lanh, Thuc Pham - Bao Quan Lanh -> Hang Dong Lanh.
-- Theo ten de chay duoc ca tren DB test; nhom khong ton tai thi bo qua.
do $$
declare
  m record;
  v_keep uuid;
begin
  for m in select * from (values
    ('TPCN', 'Thực Phẩm Chức Năng'),
    ('Hàng Tiêu Dùng', 'Hàng tiêu dùng'),
    ('Hàng lạnh', 'Hàng Đông Lạnh'),
    ('Thực Phẩm - Bảo Quản Lạnh', 'Hàng Đông Lạnh')
  ) as t(old_name, keep_name)
  loop
    select id into v_keep from public.categories where name = m.keep_name;
    if v_keep is null or not exists (select 1 from public.categories where name = m.old_name) then
      continue;
    end if;
    update public.products set category_id = v_keep
      where category_id = (select id from public.categories where name = m.old_name);
    delete from public.categories where name = m.old_name;
  end loop;
end $$;
