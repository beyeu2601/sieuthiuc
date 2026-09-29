import { cn } from "cn";
import { formatNumber } from "@/lib/format";
import type { SacNguNghia } from "@/components/ui/chip";

/*
 * Thanh tien do x/y - port tu 26c `thanh-tien-do.tsx`. So "x/y" luon in kem:
 * thanh khong co so chi noi "gan day", nguoi xem can biet con thieu bao nhieu.
 *
 * Phan da chay to bang token chu cua sac (`bg-chu-*`): token nay dam o ban sang,
 * sang o ban toi, nen tu du tuong phan tren nen `muted` o ca hai che do va ban in
 * ma khong can viet `dark:`. Viet thang tung chuoi vi Tailwind quet van ban.
 */
const TO_SAC: Record<SacNguNghia, string> = {
  brand: "bg-chu-brand",
  emerald: "bg-chu-emerald",
  amber: "bg-chu-amber",
  rose: "bg-chu-rose",
  red: "bg-chu-red",
  indigo: "bg-chu-indigo",
  sky: "bg-chu-sky",
  purple: "bg-chu-purple",
  slate: "bg-chu-slate",
  slateMo: "bg-chu-slate-mo",
  slateDam: "bg-chu-slate-dam",
};

export type ThanhTienDoProps = {
  giaTri: number;
  tong: number;
  /** Don vi in sau "x/y", vd "mã". */
  donVi: string;
  /** Cau day du cho trinh doc man hinh, vd "120 mã còn tồn trên 150 mã đang bán". */
  nhanAria: string;
  sac?: SacNguNghia;
  className?: string;
};

export function ThanhTienDo({ giaTri, tong, donVi, nhanAria, sac = "brand", className }: ThanhTienDoProps) {
  // tong = 0 (cua hang moi chua co san pham): chia ra NaN thi thanh bien mat, nen chan ve 0%.
  const phanTram = tong > 0 ? Math.min(100, Math.max(0, (giaTri / tong) * 100)) : 0;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        role="progressbar"
        aria-valuenow={giaTri}
        aria-valuemin={0}
        aria-valuemax={tong}
        aria-label={nhanAria}
        className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-muted"
      >
        <div className={cn("h-full rounded-full transition-all", TO_SAC[sac])} style={{ width: `${phanTram}%` }} />
      </div>
      <span className="shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
        {formatNumber(giaTri)}/{formatNumber(tong)} {donVi}
      </span>
    </div>
  );
}
