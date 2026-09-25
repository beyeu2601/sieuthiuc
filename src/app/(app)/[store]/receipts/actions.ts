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
  items: { product_id: string; qty: number; unit_cost: number; lot_no: string | null; expiry_date: string | null }[];
  costs: { cost_type: string; amount: number; allocation: "by_value" | "by_qty"; note: string | null }[];
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
  dueDate: string | null
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_purchase_receipt", {
    p_receipt_id: id,
    p_paid_amount: paid,
    p_payment_method: paid > 0 ? method : null,
    p_due_date: dueDate,
  });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/${storeCode}/receipts`);
  revalidatePath(`/${storeCode}/receipts/${id}`);
  revalidatePath(`/${storeCode}/inventory`);
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
