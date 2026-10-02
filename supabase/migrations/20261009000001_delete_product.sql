-- Xoa san pham (sadmin/admin). Chi xoa duoc san pham chua tung phat sinh chung tu va het ton;
-- san pham da co giao dich thi dung "Ngung ban". Lich su xoa nam trong audit_logs (trigger audit_products).

create or replace function public.delete_product(p_product_id uuid)
returns table (drive_file_id text, drive_thumb_id text)
language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
  v_stock numeric;
begin
  perform public.assert_role('sadmin', 'admin');
  select p.name into v_name from public.products p where p.id = p_product_id;
  if v_name is null then
    perform public.raise_error('NOT_FOUND', 'Không tìm thấy sản phẩm');
  end if;

  if exists (select 1 from public.sale_items where product_id = p_product_id)
     or exists (select 1 from public.order_items where product_id = p_product_id)
     or exists (select 1 from public.purchase_receipt_items where product_id = p_product_id)
     or exists (select 1 from public.stock_transfer_items where product_id = p_product_id) then
    perform public.raise_error('VALIDATION',
      'Sản phẩm đã có giao dịch (bán, nhập hoặc chuyển kho) nên không xóa được. Hãy đặt trạng thái Ngừng bán.');
  end if;

  select coalesce(sum(i.qty_on_hand + i.qty_reserved), 0) into v_stock
    from public.inventory i where i.product_id = p_product_id;
  if v_stock > 0 then
    perform public.raise_error('VALIDATION',
      format('Sản phẩm còn tồn %s. Chỉnh tồn về 0 trước khi xóa.', v_stock::float8));
  end if;

  -- tra ve ma file anh de app bo vao thung rac Drive; anh trong DB bi xoa theo san pham (on delete cascade)
  return query select i.drive_file_id, i.drive_thumb_id from public.product_images i where i.product_id = p_product_id;

  delete from public.stock_movements where product_id = p_product_id;
  delete from public.stock_lots where product_id = p_product_id;
  delete from public.inventory where product_id = p_product_id;
  delete from public.product_barcodes where product_id = p_product_id;
  delete from public.price_history where product_id = p_product_id;
  delete from public.products where id = p_product_id;
end $$;

revoke execute on function public.delete_product(uuid) from public, anon;
grant execute on function public.delete_product(uuid) to authenticated;
