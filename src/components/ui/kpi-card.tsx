import * as React from "react";
import Link from "next/link";
import { cn } from "cn";
import { CHAM_SAC, CHU_SAC, type SacNguNghia } from "@/components/ui/chip";

/*
 * The chi so cua dashboard - port gon tu 26c `kpi-card.tsx`. O 26c the bam de
 * loc danh sach ngay tai cho (aria-pressed); dashboard SieuthiUc khong co danh
 * sach de loc, bam the la sang man chi tiet, nen the o day la Link. Bo phan
 * bien dong % va trang thai dang tai vi dashboard chua co so ky truoc va da co
 * `loading.tsx` rieng.
 *
 * Dien thoai: nhan trai, so phai tren mot hang de so tien dai khong bi cat. Tu
 * sm tro len xep doc nhu the thuong.
 */
export type KpiCardProps = {
  nhan: string;
  /** Gia tri chinh, da dinh dang san bang helper cua src/lib/format. */
  giaTri: React.ReactNode;
  href: string;
  /**
   * Sac ngu nghia. Bo trong la the trung tinh. Dat vao thi nhan mang mau cua
   * trang thai va goc phai co mot cham mau (mau khong phai tin hieu duy nhat -
   * chu cua nhan van noi nghia).
   */
  sac?: SacNguNghia;
  /** Dinh nghia cua con so, hien khi re chuot. */
  chuGiai?: string;
  /** Phan phu duoi con so, vd ThanhTienDo. */
  children?: React.ReactNode;
  className?: string;
};

export function KpiCard({ nhan, giaTri, href, sac, chuGiai, children, className }: KpiCardProps) {
  return (
    <Link
      href={href}
      title={chuGiai}
      className={cn(
        "grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-2xl border bg-card px-4 py-3 transition-[border-color,box-shadow] outline-none hover:border-primary hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/50 sm:block sm:p-4",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={cn("text-sm", sac ? cn("font-medium", CHU_SAC[sac]) : "text-muted-foreground")}>{nhan}</div>
        {sac ? <span aria-hidden="true" className={cn("mt-1.5 hidden size-2.5 shrink-0 rounded-full sm:block", CHAM_SAC[sac])} /> : null}
      </div>
      <div className="text-lg font-semibold whitespace-nowrap tabular-nums sm:mt-1 sm:text-2xl">{giaTri}</div>
      {children ? <div className="col-span-2 sm:mt-2">{children}</div> : null}
    </Link>
  );
}

/** Luoi the KPI: mot cot tren dien thoai, hai cot tu sm, bon cot tu lg. */
export function HangKpi({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4", className)}>{children}</div>;
}
