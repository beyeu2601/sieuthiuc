import { cn } from "cn";
import { formatMoney } from "@/lib/format";
import { CHAM_SAC, type SacNguNghia } from "@/components/ui/chip";

/*
 * Thanh co cau 100% (stacked bar) cho co cau doanh thu / chi phi. Chon thanh
 * ngang thay cho donut: doc duoc tren man hep, va mat so do dai de hon so goc.
 *
 * Thanh chi la hinh minh hoa (aria-hidden). Chu giai ben duoi la danh sach chu
 * that - nhan, so tien, phan tram - nen trinh doc man hinh doc duoc day du ma
 * khong can bang sr-only rieng, va so lieu goc khong mat khi bo danh sach cu.
 *
 * Muc khong co sac rieng (phuong thuc, nhom chi phi) lay mau theo thu tu goc
 * cua du lieu tu SAC_THU_TU; tu muc thu 8 tro di gop chung mau slate de mau khong lap lai gay
 * nham. Muc gia tri <= 0 khong ve tren thanh nhung van co trong chu giai.
 */
const SAC_THU_TU: SacNguNghia[] = ["brand", "sky", "amber", "purple", "emerald", "rose", "indigo"];

/** Sac thu i cua bang thu tu; dung khi can mau co dinh theo mot danh sach khoa biet truoc. */
export function sacTheoThuTu(i: number): SacNguNghia {
  return SAC_THU_TU[i] ?? "slate";
}

export type MucCoCau = { key: string; label: string; value: number; sac?: SacNguNghia; note?: React.ReactNode };

export function ThanhCoCau({ title, items, className }: { title?: string; items: MucCoCau[]; className?: string }) {
  const total = items.reduce((s, x) => s + Math.max(0, x.value), 0);
  // Gan mau theo thu tu goc truoc khi sap xep, de mot muc giu mau khi thu hang doi giua cac ky
  const rows = items
    .map((x, i) => ({ ...x, sac: x.sac ?? sacTheoThuTu(i), pct: total ? Math.round((Math.max(0, x.value) / total) * 100) : 0 }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className={className}>
      {title && <div className="text-muted-foreground">{title}</div>}
      {rows.length === 0 ? (
        <div className="text-muted-foreground">-</div>
      ) : (
        <>
          {total > 0 && (
            <div aria-hidden="true" className="mt-1.5 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-muted">
              {rows
                .filter((x) => x.value > 0)
                .map((x) => (
                  <div key={x.key} className={cn("h-full first:rounded-l-full last:rounded-r-full", CHAM_SAC[x.sac])} style={{ flexBasis: `${(x.value / total) * 100}%` }} />
                ))}
            </div>
          )}
          <ul className="mt-1.5 space-y-0.5">
            {rows.map((x) => (
              <li key={x.key} className="flex items-baseline justify-between gap-2">
                <span className="flex min-w-0 items-baseline gap-1.5">
                  <span aria-hidden="true" className={cn("size-2 shrink-0 translate-y-[-1px] rounded-full", CHAM_SAC[x.sac])} />
                  <span>
                    {x.label}
                    {x.note}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatMoney(x.value)} <span className="text-xs text-muted-foreground">({x.pct}%)</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
