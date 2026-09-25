"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { errorMessage, type ActionResult } from "@/lib/errors";

export type CashPayload = {
  store_id: string;
  kind: "income" | "expense";
  category_id: string;
  occurred_on: string;
  description: string;
  amount: number;
  method: "cash" | "transfer" | "other";
  counterparty: string | null;
  doc_no: string | null;
  note: string | null;
  payment_status: "paid" | "unpaid";
  record_in_shift: boolean;
};

export async function createCash(storeCode: string, p: CashPayload): Promise<ActionResult<{ code: string; approval_status: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_cash_transaction", { p });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/${storeCode}/cash`);
  return { ok: true, data: data as { code: string; approval_status: string } };
}

export async function reviewCash(storeCode: string, id: string, approve: boolean, reason: string | null): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_cash_transaction", { p_id: id, p_approve: approve, p_reason: reason });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/${storeCode}/cash`);
  return { ok: true };
}

export async function markCashPaid(storeCode: string, id: string, paidOn: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_cash_transaction_paid", { p_id: id, p_paid_on: paidOn });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/${storeCode}/cash`);
  return { ok: true };
}
