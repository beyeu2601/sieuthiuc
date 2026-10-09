"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { errorMessage, type ActionResult } from "@/lib/errors";

export async function cancelSale(storeCode: string, saleId: string, reason: string): Promise<ActionResult> {
  if (!reason.trim()) return { ok: false, error: "Nhập lý do hủy" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_sale", { p_sale_id: saleId, p_reason: reason });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/${storeCode}/sales`);
  revalidatePath(`/${storeCode}/sales/${saleId}`);
  return { ok: true };
}

export type SaleEditPayload = {
  discount_amount: number;
  discount_note: string | null;
  note: string | null;
  payments: { method: "cash" | "transfer" | "other"; amount: number; account_id: string | null }[];
  debt: { amount: number; customer_name: string; customer_phone: string | null } | null;
};

// Sua giao dich ban tai quay khi ca con mo (khong sua dong san pham)
export async function updateSale(storeCode: string, saleId: string, p: SaleEditPayload): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_sale", { p_sale_id: saleId, p });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/${storeCode}/sales`);
  revalidatePath(`/${storeCode}/sales/${saleId}`);
  return { ok: true };
}

// Thu no khach vao tai khoan; tien mat vao ket can ca mo
export async function collectCustomerDebt(
  storeCode: string,
  debtId: string,
  p: { amount: number; account_id: string; paid_on: string; note: string | null }
): Promise<ActionResult> {
  if (!(p.amount > 0)) return { ok: false, error: "Nhập số tiền thu" };
  if (!p.account_id) return { ok: false, error: "Chọn tài khoản nhận tiền" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("collect_customer_debt", { p_debt_id: debtId, p });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/${storeCode}/sales`);
  revalidatePath(`/${storeCode}/payables`);
  return { ok: true };
}
