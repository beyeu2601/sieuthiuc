import { requireRole } from "@/lib/auth";
import { GENERAL_SETTINGS } from "@/lib/setting-defs";
import { SettingsForm } from "../settings-form";
import { ScopePicker } from "../scope-picker";
import { loadValues, resolveScope } from "../scope";

export const metadata = { title: "Cấu hình" };

export default async function GeneralSettingsPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const ctx = await requireRole("sadmin", "admin");
  const { scope } = await searchParams;
  const { storeId, label } = resolveScope(ctx, scope);
  const values = await loadValues(GENERAL_SETTINGS, storeId);

  return (
    <div className="max-w-3xl space-y-4">
      <ScopePicker basePath="/settings/general" stores={ctx.stores} current={storeId} allowGlobal={ctx.profile.role === "sadmin"} />
      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-1 font-medium">Tham số vận hành</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Đang sửa: {label}. Giá trị riêng của cửa hàng được ưu tiên hơn giá trị chung.
        </p>
        <SettingsForm key={storeId ?? "global"} defs={GENERAL_SETTINGS} values={values} storeId={storeId} />
      </section>
    </div>
  );
}
