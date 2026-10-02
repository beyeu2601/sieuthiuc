import { cn } from "cn";
import { CHU_SAC, NEN_SAC, VIEN_SAC, type SacNguNghia } from "@/components/ui/chip";

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
  className,
}: {
  nhan: string;
  giaTri: React.ReactNode;
  phu?: React.ReactNode;
  sac?: SacNguNghia;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 rounded-xl border px-4 py-3", NEN_SAC[sac], VIEN_SAC[sac], className)}>
      <div className={cn("text-sm font-medium", CHU_SAC[sac])}>{nhan}</div>
      <div className="mt-0.5 truncate text-xl font-semibold whitespace-nowrap tabular-nums lg:text-2xl">{giaTri}</div>
      {phu && <div className="mt-0.5 text-xs text-muted-foreground">{phu}</div>}
    </div>
  );
}

/** Hai cot tren dien thoai, bon cot tu lg. */
export function HangChiSo({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4", className)}>{children}</div>;
}
