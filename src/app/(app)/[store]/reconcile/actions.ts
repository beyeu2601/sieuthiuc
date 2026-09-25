"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { errorMessage, type ActionResult } from "@/lib/errors";

export async function saveReconNote(
  storeCode: string,
  storeId: string,
  day: string,
  bank: number | null,
  note: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_reconciliation_note", {
    p_store_id: storeId,
    p_day: day,
    p_bank_amount: bank,
    p_note: note,
  });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/${storeCode}/reconcile`);
  return { ok: true };
}
