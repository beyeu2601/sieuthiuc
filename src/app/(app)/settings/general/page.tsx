import { requireRole } from "@/lib/auth";
import { GENERAL_SETTINGS, EXPIRY_SETTINGS } from "@/lib/setting-defs";
import { Khoi } from "@/components/khoi";
import { ChipSac } from "@/components/ui/chip";
import { SettingsForm } from "../settings-form";
import { ScopePicker } from "../scope-picker";
import { loadValues, resolveScope } from "../scope";

export const metadata = { title: "Cấu hình" };

export default async function GeneralSettingsPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const ctx = await requireRole("sadmin", "admin");
  const { scope } = await searchParams;
  const { storeId, label } = resolveScope(ctx, scope);
  const scopeChip = (
    <ChipSac sac={storeId ? "indigo" : "slate"} title="Giá trị riêng của cửa hàng được ưu tiên hơn giá trị chung">
      Đang sửa: {label}
    </ChipSac>
  );
  const [values, expiryValues] = await Promise.all([loadValues(GENERAL_SETTINGS, storeId), loadValues(EXPIRY_SETTINGS, storeId)]);

  return (
    <div className="max-w-5xl space-y-4">
      <ScopePicker basePath="/settings/general" stores={ctx.stores} current={storeId} allowGlobal={ctx.profile.role === "sadmin"} />
      <Khoi title="Tham số vận hành" aside={scopeChip}>
        <SettingsForm key={storeId ?? "global"} defs={GENERAL_SETTINGS} values={values} storeId={storeId} />
      </Khoi>
      <Khoi title="Cận date và giá giảm" aside={scopeChip}>
        <p className="-mt-1 mb-3 text-xs text-muted-foreground" title="Ngưỡng ngày và phụ thu để đề xuất giá bán hàng cận date">
          Loại date ngắn hay dài chọn ở từng sản phẩm.
        </p>
        <SettingsForm key={`expiry-${storeId ?? "global"}`} defs={EXPIRY_SETTINGS} values={expiryValues} storeId={storeId} />
      </Khoi>
    </div>
  );
}
