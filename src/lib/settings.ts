import { createClient } from "@/lib/supabase/server";

// Doc 1 cau hinh (uu tien cua hang, fallback chung) qua RPC get_setting.
export async function getSetting<T>(key: string, fallback: T, storeId: string | null = null): Promise<T> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_setting", { p_key: key, p_store_id: storeId });
  if (error || data == null) return fallback;
  return data as T;
}

export async function getNumberSetting(key: string, fallback: number, storeId: string | null = null) {
  const v = await getSetting<unknown>(key, fallback, storeId);
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
