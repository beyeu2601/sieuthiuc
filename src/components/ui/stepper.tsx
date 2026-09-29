"use client";

import { CheckIcon } from "lucide-react";
import { cn } from "cn";

export type BuocStepper = { id: string; nhan: string };

/*
 * Thanh tien trinh cua wizard - port tu 26c `stepper.tsx`, doi sang token cua
 * SieuthiUc. Khac 26c mot diem: 26c chi cho bam lai buoc da qua; o day bam
 * duoc moi buoc ma `denDuoc(i)` tra true (FormWizard: moi buoc truoc no deu
 * hop le). Nho vay khi sua phieu nhap da du du lieu, nguoi dung nhay thang toi
 * buoc can sua thay vi bam "Tiep tuc" qua tung buoc.
 *
 * Dien thoai: chi mot dong "Buoc x/y: ten" - hang nut du buoc khong vua man hep.
 */
export function Stepper({
  buoc,
  chiSoHienTai,
  onChonBuoc,
  denDuoc,
  className,
}: {
  buoc: BuocStepper[];
  chiSoHienTai: number;
  onChonBuoc?: (chiSo: number) => void;
  denDuoc?: (chiSo: number) => boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-sm text-muted-foreground sm:hidden">
        Bước {chiSoHienTai + 1}/{buoc.length}: <span className="font-medium text-foreground">{buoc[chiSoHienTai]?.nhan}</span>
      </p>

      <ol className="hidden items-center gap-2 sm:flex">
        {buoc.map((b, i) => {
          const daXong = i < chiSoHienTai;
          const dangO = i === chiSoHienTai;
          const bamDuoc = !dangO && Boolean(onChonBuoc) && (denDuoc ? denDuoc(i) : daXong);

          return (
            <li key={b.id} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                disabled={!bamDuoc}
                onClick={() => onChonBuoc?.(i)}
                aria-current={dangO ? "step" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-lg px-1 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  bamDuoc ? "cursor-pointer hover:text-brand-strong" : "cursor-default"
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                    daXong && "border-vien-emerald bg-nen-emerald text-chu-emerald",
                    dangO && "border-primary bg-primary text-primary-foreground",
                    !daXong && !dangO && "border-transparent bg-muted text-muted-foreground"
                  )}
                >
                  {daXong ? <CheckIcon className="size-4" aria-hidden /> : i + 1}
                </span>
                <span className={cn("whitespace-nowrap", dangO ? "font-medium text-foreground" : "text-muted-foreground")}>
                  {b.nhan}
                  {daXong && <span className="sr-only"> (đã xong)</span>}
                </span>
              </button>

              {i < buoc.length - 1 ? <span aria-hidden="true" className={cn("h-px flex-1", daXong ? "bg-vien-emerald" : "bg-border")} /> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
