"use server";

import { createClient } from "@/lib/supabase/server";
import { errorMessage, type ActionResult } from "@/lib/errors";

export async function setMyPin(pin: string): Promise<ActionResult> {
  if (!/^\d{4,8}$/.test(pin)) return { ok: false, error: "Mã PIN gồm 4 đến 8 chữ số" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_my_pin", { p_pin: pin });
  if (error) return { ok: false, error: errorMessage(error) };
  return { ok: true };
}
