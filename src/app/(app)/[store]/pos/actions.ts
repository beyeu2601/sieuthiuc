"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { errorMessage, type ActionResult } from "@/lib/errors";

export type SalePayload = {
  store_id: string;
  shift_id: string;
  idempotency_key: string;
  discount_amount: number;
  approval_id: string | null;
  note: string | null;
  items: { product_id: string; qty: number; discount_amount: number }[];
  payments: { method: "cash" | "transfer" | "other"; amount: number; reference: string | null }[];
};

export async function completeSale(storeCode: string, p: SalePayload): Promise<ActionResult<{ id: string; code: string; total: number }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_sale", { p });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/${storeCode}/sales`);
  return { ok: true, data: data as { id: string; code: string; total: number } };
}

export async function requestDiscountApproval(
  storeId: string,
  username: string,
  pin: string
): Promise<ActionResult<{ approval_id: string; approved_by_name: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_discount_approval", {
    p_store_id: storeId,
    p_username: username,
    p_pin: pin,
  });
  if (error) return { ok: false, error: errorMessage(error) };
  const r = data as { ok: boolean; error?: string; approval_id?: string; approved_by_name?: string };
  if (!r.ok) return { ok: false, error: r.error ?? "Không duyệt được" };
  return { ok: true, data: { approval_id: r.approval_id!, approved_by_name: r.approved_by_name ?? "" } };
}
