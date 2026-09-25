"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { errorMessage, type ActionResult } from "@/lib/errors";

export type PaymentPayload = {
  store_id: string;
  supplier_id: string;
  amount: number;
  method: "cash" | "transfer" | "other";
  payment_date: string;
  reference: string | null;
  note: string | null;
  record_in_shift: boolean;
  allocations: { debt_id: string; amount: number }[];
};

export async function recordPayment(storeCode: string, p: PaymentPayload): Promise<ActionResult<{ id: string; code: string }>> {
  const sum = p.allocations.reduce((s, a) => s + a.amount, 0);
  if (sum !== p.amount) return { ok: false, error: "Tổng phân bổ phải bằng số tiền thanh toán" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_supplier_payment", { p });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/${storeCode}/payables`);
  return { ok: true, data: data as { id: string; code: string } };
}
