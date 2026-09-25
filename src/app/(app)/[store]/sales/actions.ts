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
