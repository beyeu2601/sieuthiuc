"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { errorMessage, type ActionResult } from "@/lib/errors";
import { productSchema, type ProductInput } from "@/lib/schemas/product";

export async function saveProduct(id: string | null, input: ProductInput): Promise<ActionResult<{ id: string }>> {
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
  const { barcode, ...v } = parsed.data;
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
    const { data, error } = await supabase.from("products").insert(row).select("id").single();
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
