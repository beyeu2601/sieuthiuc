"use client";

import * as React from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/ui/stepper";

export type BuocWizard = {
  id: string;
  nhan: string;
  /** Chan nut "Tiep tuc" khi buoc hien tai chua du du lieu. */
  hopLe: boolean;
  /** Vi sao chua di tiep duoc, hien canh nut de nguoi dung khong phai doan. */
  lyDo?: string | null;
  noiDung: React.ReactNode;
};

/*
 * Khung wizard nhieu buoc - port tu 26c `form-wizard.tsx`.
 *
 * Moi buoc deu duoc mount, buoc khong hien bi an bang `hidden`, nen du lieu da
 * nhap khong mat khi di lui roi tien lai.
 *
 * Khac 26c:
 * - `nutPhu` (vd "Luu nhap") hien o moi buoc, `nutCuoi` thay "Tiep tuc" o buoc
 *   cuoi. Nhap hang dai va hay bi ngat giua chung nen phai luu duoc bat cu luc nao.
 * - `chanTrai` nam ben trai hang nut (vd tong tien) va `lopChan` cho phep dan
 *   hang nut dinh day man hinh.
 * - Doi buoc thi dua focus vao o nhap dau tien cua buoc moi (vd o tim san pham,
 *   de may quet dung duoc ngay), khong co o nhap thi vao chinh khung buoc.
 */
export function FormWizard({
  buoc,
  buocDau = 0,
  nutCuoi,
  nutPhu,
  chanTrai,
  lopChan,
  className,
}: {
  buoc: BuocWizard[];
  buocDau?: number;
  nutCuoi?: React.ReactNode;
  nutPhu?: React.ReactNode;
  chanTrai?: React.ReactNode;
  lopChan?: string;
  className?: string;
}) {
  const [chiSo, setChiSo] = React.useState(Math.min(buocDau, buoc.length - 1));
  const khungRef = React.useRef<HTMLDivElement>(null);
  const daDoiBuoc = React.useRef(false);
  const buocCuoi = chiSo === buoc.length - 1;
  const hienTai = buoc[chiSo];
  const denDuoc = (i: number) => buoc.slice(0, i).every((b) => b.hopLe);

  function sangBuoc(i: number) {
    daDoiBuoc.current = true;
    setChiSo(i);
  }

  React.useEffect(() => {
    if (!daDoiBuoc.current) return;
    const khung = khungRef.current?.querySelector<HTMLElement>(`[data-buoc="${chiSo}"]`);
    const o = khung?.querySelector<HTMLElement>("input:not([type=hidden]), select, textarea");
    (o ?? khung)?.focus();
  }, [chiSo]);

  return (
    <div className={className}>
      <Stepper buoc={buoc.map((b) => ({ id: b.id, nhan: b.nhan }))} chiSoHienTai={chiSo} onChonBuoc={sangBuoc} denDuoc={denDuoc} />

      <div ref={khungRef} className="mt-4">
        {buoc.map((b, i) => (
          <div key={b.id} data-buoc={i} hidden={i !== chiSo} tabIndex={-1} className="outline-none" aria-label={b.nhan} role="group">
            {b.noiDung}
          </div>
        ))}
      </div>

      <div className={cn("mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-sm sm:p-4", lopChan)}>
        <div className="min-w-0 text-sm">{chanTrai}</div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {!hienTai?.hopLe && hienTai?.lyDo ? (
            <p className="w-full text-right text-xs text-muted-foreground" aria-live="polite">
              {hienTai.lyDo}
            </p>
          ) : null}
          <Button type="button" variant="outline" className="h-11" disabled={chiSo === 0} onClick={() => sangBuoc(Math.max(0, chiSo - 1))}>
            Quay lại
          </Button>
          {nutPhu}
          {buocCuoi ? (
            nutCuoi
          ) : (
            <Button type="button" className="h-11" disabled={!hienTai?.hopLe} onClick={() => sangBuoc(Math.min(buoc.length - 1, chiSo + 1))}>
              Tiếp tục
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
