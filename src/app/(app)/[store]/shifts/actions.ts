"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { errorMessage, type ActionResult } from "@/lib/errors";

export async function openShift(storeCode: string, storeId: string, openingCash: number): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("open_shift", { p_store_id: storeId, p_opening_cash: openingCash });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/${storeCode}/shifts`);
  revalidatePath(`/${storeCode}/pos`);
  return { ok: true };
}

export async function closeShift(
  storeCode: string,
  shiftId: string,
  counted: number,
  note: string
): Promise<ActionResult<{ expected_cash: number; cash_diff: number; status: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("close_shift", { p_shift_id: shiftId, p_counted_cash: counted, p_note: note });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/${storeCode}/shifts`);
  revalidatePath(`/${storeCode}/shifts/${shiftId}`);
  revalidatePath(`/${storeCode}/pos`);
  return { ok: true, data: data as { expected_cash: number; cash_diff: number; status: string } };
}

export async function approveShift(storeCode: string, shiftId: string, note: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_shift", { p_shift_id: shiftId, p_note: note || null });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/${storeCode}/shifts`);
  revalidatePath(`/${storeCode}/shifts/${shiftId}`);
  return { ok: true };
}

export async function adjustShiftCount(storeCode: string, shiftId: string, counted: number, reason: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("adjust_shift_count", { p_shift_id: shiftId, p_counted_cash: counted, p_reason: reason });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/${storeCode}/shifts/${shiftId}`);
  return { ok: true };
}
