"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { errorMessage, type ActionResult } from "@/lib/errors";

export async function createTransfer(
  storeCode: string,
  p: { from_store_id: string; to_store_id: string; note: string | null; items: { lot_id: string; qty: number }[] },
  send: boolean
): Promise<ActionResult<{ id: string }>> {
  if (!p.to_store_id) return { ok: false, error: "Chọn cửa hàng nhận" };
  if (p.items.length === 0) return { ok: false, error: "Thêm ít nhất một dòng hàng" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_transfer", { p });
  if (error) return { ok: false, error: errorMessage(error) };
  const id = (data as { id: string }).id;
  if (send) {
    const res = await supabase.rpc("send_transfer", { p_transfer_id: id });
    if (res.error) return { ok: false, error: `Đã lưu nháp nhưng chưa gửi được: ${errorMessage(res.error)}` };
  }
  revalidatePath(`/${storeCode}/transfers`);
  return { ok: true, data: { id } };
}

export async function transferAction(
  storeCode: string,
  id: string,
  action: "send" | "receive" | "return" | "cancel"
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } =
    action === "send"
      ? await supabase.rpc("send_transfer", { p_transfer_id: id })
      : action === "cancel"
        ? await supabase.rpc("cancel_transfer", { p_transfer_id: id })
        : await supabase.rpc("receive_transfer", { p_transfer_id: id, p_return: action === "return" });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/${storeCode}/transfers`);
  revalidatePath(`/${storeCode}/transfers/${id}`);
  return { ok: true };
}
