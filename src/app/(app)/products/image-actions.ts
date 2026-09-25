"use server";

import { revalidatePath } from "next/cache";
import { getSessionContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { errorMessage, type ActionResult } from "@/lib/errors";
import { driveConfigured, trashOnDrive, uploadToDrive } from "@/lib/google-drive";

const MAX_BYTES = 3 * 1024 * 1024;

function done(productId: string) {
  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
}

// Client da thu nho anh: "full" (canh dai toi da 1600px) va "thumb" (vuong 400px), deu JPEG.
export async function uploadProductImage(productId: string, form: FormData): Promise<ActionResult> {
  const ctx = await getSessionContext();
  if (!ctx || !["sadmin", "admin"].includes(ctx.profile.role)) return { ok: false, error: "Bạn không có quyền thêm ảnh." };
  if (!driveConfigured()) return { ok: false, error: "Chưa kết nối Google Drive." };
  const full = form.get("full");
  const thumb = form.get("thumb");
  if (!(full instanceof Blob) || !(thumb instanceof Blob) || full.type !== "image/jpeg" || thumb.type !== "image/jpeg") {
    return { ok: false, error: "Ảnh không hợp lệ." };
  }
  if (full.size > MAX_BYTES || thumb.size > MAX_BYTES) return { ok: false, error: "Ảnh quá lớn." };

  const supabase = await createClient();
  const { data: p } = await supabase.from("products").select("sku").eq("id", productId).maybeSingle();
  if (!p) return { ok: false, error: "Không tìm thấy sản phẩm." };
  const { count } = await supabase.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", productId);
  if ((count ?? 0) >= 10) return { ok: false, error: "Mỗi sản phẩm tối đa 10 ảnh." };

  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  let ids: string[] = [];
  try {
    ids = await Promise.all([uploadToDrive(`${p.sku}_${stamp}.jpg`, full), uploadToDrive(`${p.sku}_${stamp}_nho.jpg`, thumb)]);
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Không tải được ảnh lên Google Drive. Thử lại sau." };
  }
  const { error } = await supabase.rpc("add_product_image", { p_product_id: productId, p_file_id: ids[0], p_thumb_id: ids[1] });
  if (error) {
    await Promise.allSettled(ids.map(trashOnDrive));
    return { ok: false, error: errorMessage(error) };
  }
  done(productId);
  return { ok: true };
}

export async function setProductThumbnail(productId: string, imageId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_product_thumbnail", { p_image_id: imageId });
  if (error) return { ok: false, error: errorMessage(error) };
  done(productId);
  return { ok: true };
}

export async function deleteProductImage(productId: string, imageId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_product_image", { p_image_id: imageId });
  if (error) return { ok: false, error: errorMessage(error) };
  const row = (data as { drive_file_id: string; drive_thumb_id: string }[])[0];
  // DB da xoa; loi o Drive chi de lai file trong thu muc, khong anh huong app
  if (row) await Promise.allSettled([trashOnDrive(row.drive_file_id), trashOnDrive(row.drive_thumb_id)]);
  done(productId);
  return { ok: true };
}
