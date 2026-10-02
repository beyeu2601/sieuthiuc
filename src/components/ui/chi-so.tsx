import { cn } from "cn";
import type { LucideIcon } from "lucide-react";
import { CHU_SAC, NEN_SAC, VIEN_SAC, type SacNguNghia } from "@/components/ui/chip";
import { GoiY } from "@/components/goi-y";

/*
 * O chi so dau trang (mau trang chi tiet san pham, 02/10/2026): nen nhat + vien
 * theo sac ngu nghia. Khac KpiCard la khong phai Link. Nhan phai noi nghia bang
 * chu ("Het hang", "Lo hoac hoa") vi mau khong phai tin hieu duy nhat.
 */
export function ChiSo({
  nhan,
  giaTri,
  phu,
  sac = "slate",
  icon: Icon,
  goiY,
  className,
}: {
  nhan: string;
  giaTri: React.ReactNode;
  phu?: React.ReactNode;
  sac?: SacNguNghia;
  icon?: LucideIcon;
  /** Noi dung nut (i): cach tinh, nguong */
  goiY?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 rounded-xl border px-4 py-3", NEN_SAC[sac], VIEN_SAC[sac], className)}>
      <div className={cn("flex items-center gap-1.5 text-sm font-medium", CHU_SAC[sac])}>
        {Icon && <Icon aria-hidden className="size-4 shrink-0" />}
        <span className="min-w-0">{nhan}</span>
        {goiY && <GoiY label={nhan}>{goiY}</GoiY>}
      </div>
      <div className="mt-0.5 truncate text-xl font-semibold whitespace-nowrap tabular-nums lg:text-2xl">{giaTri}</div>
      {phu && <div className="mt-0.5 text-xs text-muted-foreground">{phu}</div>}
    </div>
  );
}

/** Hai cot tren dien thoai, bon cot tu lg. */
export function HangChiSo({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4", className)}>{children}</div>;
}
