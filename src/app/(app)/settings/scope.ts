import type { SessionContext } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import type { SettingDef } from "@/lib/setting-defs";

// Pham vi cau hinh: sadmin sua cau hinh chung (mac dinh) hoac rieng cua hang; admin chi sua rieng cua hang minh.
export function resolveScope(ctx: SessionContext, scope: string | undefined) {
  const isSadmin = ctx.profile.role === "sadmin";
  const store = ctx.stores.find((s) => s.id === scope);
  if (store) return { storeId: store.id as string | null, label: `Riêng cửa hàng ${store.code}` };
  if (isSadmin) return { storeId: null, label: "Chung cho mọi cửa hàng" };
  const first = ctx.stores[0];
  return { storeId: first?.id ?? null, label: first ? `Riêng cửa hàng ${first.code}` : "" };
}

export async function loadValues(defs: SettingDef[], storeId: string | null) {
  const entries = await Promise.all(defs.map(async (d) => [d.key, await getSetting<unknown>(d.key, null, storeId)] as const));
  return Object.fromEntries(entries);
}
