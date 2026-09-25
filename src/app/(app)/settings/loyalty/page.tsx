import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LOYALTY_SETTINGS } from "@/lib/setting-defs";
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
      <p className="rounded-lg bg-muted px-3 py-2 text-sm">
        Tích điểm và dùng điểm khi bán hàng thuộc giai đoạn 2. Có thể thiết lập trước quy tắc và hạng ở đây.
      </p>
      <section className="rounded-xl border bg-background p-4">
        <h2 className="mb-1 font-medium">Hạng thành viên</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Khách tự lên hạng khi tổng chi tiêu đạt ngưỡng. Hệ số nhân điểm tích; giảm giá áp dụng tự động khi bán.
        </p>
        <TierEditor rows={tiers ?? []} />
      </section>
      <section className="rounded-xl border bg-background p-4">
        <h2 className="mb-1 font-medium">Quy tắc điểm</h2>
        <p className="mb-3 text-sm text-muted-foreground">Đang sửa: {label}.</p>
        <div className="mb-3">
          <ScopePicker basePath="/settings/loyalty" stores={ctx.stores} current={storeId} allowGlobal={ctx.profile.role === "sadmin"} />
        </div>
        <SettingsForm key={storeId ?? "global"} defs={LOYALTY_SETTINGS} values={values} storeId={storeId} />
      </section>
    </div>
  );
}
