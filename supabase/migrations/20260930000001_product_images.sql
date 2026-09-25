-- Anh san pham luu tren Google Drive. DB chi giu ma file Drive (ban lon va ban nho).
-- Toi da 10 anh moi san pham, dung mot anh lam anh dai dien (hien o danh sach).
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  drive_file_id text not null unique,
  drive_thumb_id text not null unique,
  is_thumbnail boolean not null default false,
  sort_order int not null default 0,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index product_images_product_idx on public.product_images(product_id, sort_order);
create unique index product_images_one_thumbnail on public.product_images(product_id) where is_thumbnail;

create trigger audit_product_images after insert or update or delete on public.product_images
  for each row execute function public.audit_row_change();

-- Doc: moi nguoi dung dang nhap (anh khong chua gia von). Ghi: chi qua RPC.
alter table public.product_images enable row level security;
create policy product_images_select on public.product_images for select to authenticated
  using ((select public.auth_role()) is not null);

create or replace function public.add_product_image(p_product_id uuid, p_file_id text, p_thumb_id text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_count int;
begin
  perform public.assert_role('sadmin','admin');
  -- khoa san pham de hai lan tai cung luc khong vuot 10 anh
  perform 1 from public.products where id = p_product_id for update;
  if not found then
    perform public.raise_error('NOT_FOUND', 'Không tìm thấy sản phẩm');
  end if;
  if coalesce(p_file_id, '') = '' or coalesce(p_thumb_id, '') = '' then
    perform public.raise_error('VALIDATION', 'Thiếu mã file ảnh');
  end if;
  select count(*) into v_count from public.product_images where product_id = p_product_id;
  if v_count >= 10 then
    perform public.raise_error('VALIDATION', 'Mỗi sản phẩm tối đa 10 ảnh');
  end if;
  insert into public.product_images(product_id, drive_file_id, drive_thumb_id, is_thumbnail, sort_order)
  values (p_product_id, p_file_id, p_thumb_id, v_count = 0,
          coalesce((select max(sort_order) + 1 from public.product_images where product_id = p_product_id), 0))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.set_product_thumbnail(p_image_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_product uuid;
begin
  perform public.assert_role('sadmin','admin');
  select product_id into v_product from public.product_images where id = p_image_id;
  if v_product is null then
    perform public.raise_error('NOT_FOUND', 'Không tìm thấy ảnh');
  end if;
  update public.product_images set is_thumbnail = false where product_id = v_product and is_thumbnail and id <> p_image_id;
  update public.product_images set is_thumbnail = true where id = p_image_id and not is_thumbnail;
end $$;

-- Xoa anh; neu la anh dai dien thi anh con lai dau tien thanh anh dai dien.
-- Tra ve hai ma file de server bo vao thung rac Drive.
create or replace function public.delete_product_image(p_image_id uuid)
returns table (drive_file_id text, drive_thumb_id text)
language plpgsql security definer set search_path = '' as $$
declare r public.product_images;
begin
  perform public.assert_role('sadmin','admin');
  delete from public.product_images i where i.id = p_image_id returning i.* into r;
  if r.id is null then
    perform public.raise_error('NOT_FOUND', 'Không tìm thấy ảnh');
  end if;
  if r.is_thumbnail then
    update public.product_images i set is_thumbnail = true
     where i.id = (select x.id from public.product_images x where x.product_id = r.product_id
                    order by x.sort_order, x.created_at limit 1);
  end if;
  return query select r.drive_file_id, r.drive_thumb_id;
end $$;

revoke execute on function public.add_product_image(uuid, text, text) from public, anon;
revoke execute on function public.set_product_thumbnail(uuid) from public, anon;
revoke execute on function public.delete_product_image(uuid) from public, anon;
