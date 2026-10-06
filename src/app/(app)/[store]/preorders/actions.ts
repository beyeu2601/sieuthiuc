"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { errorMessage, type ActionResult } from "@/lib/errors";

export type PreorderPayload = {
  store_id: string;
  customer_name: string;
  customer_phone: string | null;
  ordered_on: string;
  due_on: string;
  deposit_type: "percent" | "amount";
  deposit_value: number;
  account_id: string | null;
  paid_on: string;
  note: string | null;
  items: { product_id: string; qty: number; unit_price: number; unit_cost: number | null }[];
};

export async function createPreorder(storeCode: string, p: PreorderPayload): Promise<ActionResult<{ id: string; code: string }>> {
  if (p.items.length === 0) return { ok: false, error: "Thêm ít nhất một sản phẩm" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_preorder", { p });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/${storeCode}/preorders`);
  return { ok: true, data: data as { id: string; code: string } };
}

// Gia von mac dinh de dien san tren form (chi quan ly goi duoc)
export async function defaultCosts(storeId: string, productIds: string[]): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("product_default_costs", { p_store_id: storeId, p_ids: productIds });
  return Object.fromEntries(((data ?? []) as { product_id: string; unit_cost: number }[]).map((r) => [r.product_id, r.unit_cost]));
}

function done(storeCode: string, id: string) {
  revalidatePath(`/${storeCode}/preorders`);
  revalidatePath(`/${storeCode}/preorders/${id}`);
}

export async function addDeposit(
  storeCode: string,
  id: string,
  p: { amount: number; account_id: string; paid_on: string; note: string | null }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_preorder_deposit", { p_id: id, p });
  if (error) return { ok: false, error: errorMessage(error) };
  done(storeCode, id);
  return { ok: true };
}

export async function markArrived(storeCode: string, id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_preorder_arrived", { p_id: id });
  if (error) return { ok: false, error: errorMessage(error) };
  done(storeCode, id);
  return { ok: true };
}

export async function deliverPreorder(storeCode: string, id: string, accountId: string | null): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("deliver_preorder", { p_id: id, p: { account_id: accountId } });
  if (error) return { ok: false, error: errorMessage(error) };
  done(storeCode, id);
  return { ok: true };
}

export async function cancelPreorder(
  storeCode: string,
  id: string,
  p: { reason: string; deposit: "refund" | "keep" | null; account_id: string | null; on: string }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_preorder", { p_id: id, p });
  if (error) return { ok: false, error: errorMessage(error) };
  done(storeCode, id);
  return { ok: true };
}
