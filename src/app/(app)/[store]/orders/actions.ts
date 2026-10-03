"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { errorMessage, type ActionResult } from "@/lib/errors";

export type OrderPayload = {
  store_id: string;
  channel: "shopee" | "facebook" | "other";
  external_order_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  shipping_address: string | null;
  shipping_fee: number;
  discount_amount: number;
  discount_note: string | null;
  payout_amount: number | null;
  deliver_now: boolean;
  payment_method: "cash" | "transfer" | "other";
  note: string | null;
  items: { product_id: string; qty: number; unit_price: number }[];
};

export async function createOrder(storeCode: string, p: OrderPayload): Promise<ActionResult<{ id: string; code: string }>> {
  if (p.items.length === 0) return { ok: false, error: "Thêm ít nhất một sản phẩm" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_order", { p });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/${storeCode}/orders`);
  return { ok: true, data: data as { id: string; code: string } };
}

export async function changeOrderStatus(
  storeCode: string,
  id: string,
  to: "shipped" | "delivered" | "cancelled",
  note: string | null
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_order_status", { p_order_id: id, p_to: to, p_note: note });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/${storeCode}/orders`);
  revalidatePath(`/${storeCode}/orders/${id}`);
  return { ok: true };
}

// Xoa don da huy hoac da hoan va nhap lai kho (sadmin/admin)
export async function deleteOrder(storeCode: string, id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_order", { p_order_id: id });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/${storeCode}/orders`);
  return { ok: true };
}

// Hoan hang don da giao: bo doanh thu, hang cho quan ly kiem moi vao lai kho
export async function returnOrder(storeCode: string, id: string, reason: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("return_order", { p_order_id: id, p_reason: reason });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/${storeCode}/orders`);
  revalidatePath(`/${storeCode}/orders/${id}`);
  return { ok: true };
}

export async function reviewReturn(storeCode: string, id: string, restock: boolean, note: string | null): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_order_return", { p_order_id: id, p_restock: restock, p_note: note });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/${storeCode}/orders`);
  revalidatePath(`/${storeCode}/orders/${id}`);
  return { ok: true };
}

export type PayoutPayload = {
  store_id: string;
  account_id: string;
  received_on: string;
  amount_received: number;
  ads_amount: number;
  note: string | null;
  order_ids: string[];
};

export async function recordPayout(storeCode: string, p: PayoutPayload): Promise<ActionResult<{ id: string; code: string }>> {
  if (p.order_ids.length === 0) return { ok: false, error: "Chọn ít nhất một đơn" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_platform_payout", { p: { ...p, channel: "shopee" } });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/${storeCode}/orders`, "layout");
  return { ok: true, data: data as { id: string; code: string } };
}

export async function cancelPayout(storeCode: string, id: string, reason: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_platform_payout", { p_payout_id: id, p_reason: reason });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/${storeCode}/orders`, "layout");
  return { ok: true };
}
