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
