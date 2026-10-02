import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LOYALTY_SETTINGS } from "@/lib/setting-defs";
import { Khoi } from "@/components/khoi";
import { ChipSac } from "@/components/ui/chip";
import { SettingsForm } from "../settings-form";
import { ScopePicker } from "../scope-picker";
import { loadValues, resolveScope } from "../scope";
import { TierEditor } from "./tier-editor";

export const metadata = { title: "Thành viên" };

export default async function LoyaltySettingsPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const ctx = await requireRole("sadmin", "admin");
  const { scope } = await searchParams;
  const { storeId, label } = resolveScope(ctx, scope);
  const supabase = await createClient();
  const [{ data: tiers }, values] = await Promise.all([
    supabase.from("member_tiers").select("id, name, rank, min_total_spent, earn_multiplier, discount_pct").order("rank"),
    loadValues(LOYALTY_SETTINGS, storeId),
  ]);

  return (
    <div className="max-w-4xl space-y-4">
      <p className="text-xs text-muted-foreground">Tích điểm và dùng điểm khi bán hàng thuộc giai đoạn 2, có thể thiết lập trước.</p>
      <Khoi title="Hạng thành viên">
        <p
          className="-mt-1 mb-1 text-xs text-muted-foreground"
          title="Khách tự lên hạng khi tổng chi tiêu đạt ngưỡng. Hệ số nhân điểm tích; giảm giá áp dụng tự động khi bán."
        >
          Tự lên hạng khi tổng chi tiêu đạt ngưỡng.
        </p>
        <TierEditor rows={tiers ?? []} />
      </Khoi>
      <Khoi title="Quy tắc điểm" aside={<ChipSac sac={storeId ? "indigo" : "slate"}>Đang sửa: {label}</ChipSac>}>
        <div className="mb-3">
          <ScopePicker basePath="/settings/loyalty" stores={ctx.stores} current={storeId} allowGlobal={ctx.profile.role === "sadmin"} />
        </div>
        <SettingsForm key={storeId ?? "global"} defs={LOYALTY_SETTINGS} values={values} storeId={storeId} />
      </Khoi>
    </div>
  );
}
