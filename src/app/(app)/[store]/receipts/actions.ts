"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { errorMessage, type ActionResult } from "@/lib/errors";

export type ReceiptPayload = {
  id: string | null;
  store_id: string;
  supplier_id: string;
  receipt_date: string;
  invoice_no: string | null;
  due_date: string | null;
  note: string | null;
  items: { product_id: string; qty: number; unit_cost: number; lot_no: string | null; expiry_date: string | null; sell_price: number | null }[];
  costs: { cost_type: string; amount: number; allocation: "by_value" | "by_qty"; note: string | null }[];
  discount_amount: number;
  discount_note: string | null;
};

export async function saveReceipt(storeCode: string, p: ReceiptPayload): Promise<ActionResult<{ id: string; code: string }>> {
  if (!p.supplier_id) return { ok: false, error: "Chọn nhà cung cấp" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_purchase_receipt", { p });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/${storeCode}/receipts`);
  return { ok: true, data: data as { id: string; code: string } };
}

export async function confirmReceipt(
  storeCode: string,
  id: string,
  paid: number,
  method: "cash" | "transfer" | "other" | null,
  dueDate: string | null,
  recordInShift = false,
  accountId: string | null = null
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_purchase_receipt", {
    p_receipt_id: id,
    p_paid_amount: paid,
    p_payment_method: paid > 0 ? method : null,
    p_due_date: dueDate,
    p_record_in_shift: recordInShift && method === "cash" && paid > 0,
    p_account_id: paid > 0 ? accountId : null,
  });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/${storeCode}/receipts`);
  revalidatePath(`/${storeCode}/receipts/${id}`);
  revalidatePath(`/${storeCode}/inventory`);
  return { ok: true };
}

// Tao nhanh san pham ngay tren phieu nhap (chi sadmin/admin theo RLS)
export async function quickCreateProduct(input: {
  name: string;
  goods_type: "cont" | "air";
  unit: string;
  sell_price: number;
  date_type: "short" | "long";
}): Promise<ActionResult<{ product_id: string; sku: string; name: string; unit: string; goods_type: "cont" | "air"; expiry_level: "none" | "product" | "lot" }>> {
  const name = input.name.trim();
  const unit = input.unit.trim();
  if (!name) return { ok: false, error: "Nhập tên sản phẩm" };
  if (!unit) return { ok: false, error: "Nhập đơn vị tính" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .insert({
      name,
      unit,
      goods_type: input.goods_type,
      sell_price: Math.max(0, Math.round(input.sell_price || 0)),
      pricing_method: "manual",
      expiry_level: "none",
      date_type: input.date_type === "short" ? "short" : "long",
      status: "active",
    })
    .select("id, sku, name, unit, goods_type, expiry_level")
    .single();
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/products");
  return {
    ok: true,
    data: {
      product_id: data.id,
      sku: data.sku,
      name: data.name,
      unit: data.unit,
      goods_type: data.goods_type as "cont" | "air",
      expiry_level: data.expiry_level as "none" | "product" | "lot",
    },
  };
}

// Tao nhanh nha cung cap ngay tren phieu nhap (RLS cho phep sadmin/admin/accountant)
export async function quickCreateSupplier(input: {
  name: string;
  phone: string;
  payment_terms_days: number;
}): Promise<ActionResult<{ id: string; code: string; name: string; payment_terms_days: number }>> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Nhập tên nhà cung cấp" };
  const terms = Math.min(365, Math.max(0, Math.round(input.payment_terms_days || 0)));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suppliers")
    .insert({ name, phone: input.phone.trim() || null, payment_terms_days: terms })
    .select("id, code, name, payment_terms_days")
    .single();
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/suppliers");
  return { ok: true, data };
}

// Mo lai phieu da xac nhan ve nhap de sua (chi sadmin/admin, va chi khi dao nguoc sach se)
export async function reopenReceipt(storeCode: string, id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reopen_purchase_receipt", { p_receipt_id: id });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/${storeCode}/receipts`);
  revalidatePath(`/${storeCode}/receipts/${id}`);
  revalidatePath(`/${storeCode}/inventory`);
  return { ok: true };
}

// Ghi chiet khau cho phieu da xac nhan: giam no, hoac giam khoan tra khi nhap (sadmin/admin)
export async function addReceiptDiscount(storeCode: string, id: string, amount: number, note: string): Promise<ActionResult> {
  if (!(amount > 0)) return { ok: false, error: "Nhập số tiền chiết khấu" };
  if (!note.trim()) return { ok: false, error: "Nhập lý do chiết khấu" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_receipt_discount", { p_receipt_id: id, p_amount: amount, p_note: note });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/${storeCode}/receipts`);
  revalidatePath(`/${storeCode}/receipts/${id}`);
  revalidatePath(`/${storeCode}/payables`);
  return { ok: true };
}

export async function cancelReceipt(storeCode: string, id: string, reason: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_purchase_receipt", { p_receipt_id: id, p_reason: reason });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/${storeCode}/receipts`);
  revalidatePath(`/${storeCode}/receipts/${id}`);
  return { ok: true };
}
