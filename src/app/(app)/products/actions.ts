"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { errorMessage, type ActionResult } from "@/lib/errors";
import { trashOnDrive } from "@/lib/google-drive";
import { productSchema, type ProductInput } from "@/lib/schemas/product";

export async function saveProduct(id: string | null, input: ProductInput): Promise<ActionResult<{ id: string }>> {
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
  // Giá vốn nhập khi tạo; sau đó sửa qua adjustProductStock hoặc do nhập hàng (giá vốn bình quân) cập nhật.
  const { barcode, cost_price_ref, ...v } = parsed.data;
  const row = {
    ...v,
    expiry_date: v.expiry_level === "product" ? v.expiry_date : null,
    note: v.note || null,
  };

  const supabase = await createClient();
  let productId = id;
  if (id) {
    const { error } = await supabase.from("products").update(row).eq("id", id);
    if (error) return { ok: false, error: errorMessage(error) };
  } else {
    const { data, error } = await supabase.from("products").insert({ ...row, cost_price_ref: cost_price_ref ?? 0 }).select("id").single();
    if (error) return { ok: false, error: errorMessage(error) };
    productId = data.id;
    if (barcode) {
      const res = await supabase.rpc("add_product_barcode", { p_product_id: productId, p_barcode: barcode });
      if (res.error) {
        revalidatePath("/products");
        return { ok: false, error: `Đã tạo sản phẩm nhưng chưa gán được mã vạch: ${errorMessage(res.error)}` };
      }
    }
  }
  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  return { ok: true, data: { id: productId! } };
}

// Chinh truc tiep ton kho (so ton thuc te) va gia von cua san pham tai 1 cua hang. cost = null: giu gia von.
// Tao nhanh thuong hieu ngay trong form san pham (RLS: sadmin/admin)
export async function quickCreateBrand(name: string): Promise<ActionResult<{ id: string; name: string }>> {
  const n = name.trim();
  if (!n) return { ok: false, error: "Nhập tên thương hiệu" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("brands").insert({ name: n }).select("id, name").single();
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/settings/catalog");
  return { ok: true, data };
}

export async function adjustProductStock(
  productId: string,
  storeId: string,
  qty: number,
  cost: number | null,
  expiry: string | null,
  note: string | null
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("adjust_product_stock", {
    p_store_id: storeId,
    p_product_id: productId,
    p_qty: qty,
    p_cost: cost,
    p_expiry: expiry,
    p_note: note,
  });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  return { ok: true };
}

export async function addBarcode(
  productId: string,
  barcode: string,
  packQty: number,
  isPrimary: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_product_barcode", {
    p_product_id: productId,
    p_barcode: barcode,
    p_type: "ean",
    p_pack_qty: packQty,
    p_is_primary: isPrimary,
  });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/products/${productId}`);
  return { ok: true };
}

export async function generateInternalBarcode(productId: string): Promise<ActionResult<{ code: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_internal_barcode", { p_product_id: productId });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/products/${productId}`);
  return { ok: true, data: { code: data as string } };
}

export async function setPrimaryBarcode(productId: string, barcodeId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_primary_barcode", { p_barcode_id: barcodeId });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/products/${productId}`);
  return { ok: true };
}

export async function deleteBarcode(productId: string, barcodeId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("product_barcodes")
    .delete({ count: "exact" })
    .eq("id", barcodeId);
  if (error) return { ok: false, error: errorMessage(error) };
  if (!count) return { ok: false, error: "Bạn không có quyền xóa mã vạch này." };
  revalidatePath(`/products/${productId}`);
  return { ok: true };
}

export async function applyPriceSuggestions(ids: string[]): Promise<ActionResult<{ count: number }>> {
  if (ids.length === 0) return { ok: false, error: "Chọn ít nhất một sản phẩm" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_price_suggestions", { p_product_ids: ids });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/products");
  revalidatePath("/products/price-suggestions");
  return { ok: true, data: { count: data as number } };
}

// Gan nhom hang / thuong hieu cho nhieu san pham mot lan (RLS products_update: sadmin/admin).
// Truong undefined thi giu nguyen.
export async function bulkUpdateProducts(
  ids: string[],
  patch: { category_id?: string; brand_id?: string }
): Promise<ActionResult<{ count: number }>> {
  if (ids.length === 0) return { ok: false, error: "Chọn ít nhất một sản phẩm" };
  const row = Object.fromEntries(Object.entries(patch).filter(([, v]) => v));
  if (Object.keys(row).length === 0) return { ok: false, error: "Chọn nhóm hàng hoặc thương hiệu cần gán" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("products").update(row).in("id", ids).select("id");
  if (error) return { ok: false, error: errorMessage(error) };
  if (!data || data.length === 0) return { ok: false, error: "Bạn không có quyền sửa các sản phẩm này." };
  revalidatePath("/products");
  return { ok: true, data: { count: data.length } };
}

export type ImportRow = {
  row: number;
  name: string;
  unit: string;
  goods_type: string;
  sell_price: number | null;
  category: string | null;
  brand: string | null;
  barcode: string | null;
  min_stock: number | null;
  note: string | null;
};

export async function importProducts(items: ImportRow[]): Promise<ActionResult<{ products: number }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_products", { p_items: items });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/products");
  return { ok: true, data: data as { products: number } };
}

export async function deleteProduct(productId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_product", { p_product_id: productId });
  if (error) return { ok: false, error: errorMessage(error) };
  // DB da xoa; loi o Drive chi de lai file trong thu muc, khong anh huong app
  const files = (data as { drive_file_id: string; drive_thumb_id: string }[] | null) ?? [];
  await Promise.allSettled(files.flatMap((f) => [trashOnDrive(f.drive_file_id), trashOnDrive(f.drive_thumb_id)]));
  revalidatePath("/products");
  return { ok: true };
}
