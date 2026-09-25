"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { errorMessage, type ActionResult } from "@/lib/errors";
import { supplierSchema, type SupplierInput } from "@/lib/schemas/supplier";

export async function saveSupplier(id: string | null, input: SupplierInput): Promise<ActionResult<{ id: string }>> {
  const parsed = supplierSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
  const row = Object.fromEntries(
    Object.entries(parsed.data).map(([k, v]) => [k, typeof v === "string" && v.trim() === "" ? null : v])
  );
  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("suppliers").update(row).eq("id", id);
    if (error) return { ok: false, error: errorMessage(error) };
    revalidatePath("/suppliers");
    revalidatePath(`/suppliers/${id}`);
    return { ok: true, data: { id } };
  }
  const { data, error } = await supabase.from("suppliers").insert(row).select("id").single();
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/suppliers");
  return { ok: true, data: { id: data.id } };
}
