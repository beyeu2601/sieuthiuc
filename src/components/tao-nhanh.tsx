"use client";

import { useRouter } from "next/navigation";
import { CalendarClockIcon, PackagePlusIcon, TruckIcon, WalletIcon, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type ThaoTac = { nhan: string; phu: string; href: string; Icon: LucideIcon; khung: string; tron: string };

// Thao tac cua nut + giua thanh day (khach chot 07/10/2026, theo khuon "Tao nhanh" cua app 26C)
const THAO_TAC: ThaoTac[] = [
  {
    nhan: "Đặt trước",
    phu: "Khách đặt hàng order",
    href: "/{store}/preorders/new",
    Icon: CalendarClockIcon,
    khung: "bg-nen-purple border-vien-purple text-chu-purple",
    tron: "bg-chu-purple",
  },
  {
    nhan: "Đơn online",
    phu: "Shopee, Facebook",
    href: "/{store}/orders/new",
    Icon: TruckIcon,
    khung: "bg-nen-amber border-vien-amber text-chu-amber",
    tron: "bg-chu-amber",
  },
  {
    nhan: "Nhập hàng",
    phu: "Phiếu nhập mới",
    href: "/{store}/receipts/new",
    Icon: PackagePlusIcon,
    khung: "bg-nen-brand border-vien-brand text-chu-brand",
    tron: "bg-chu-brand",
  },
  {
    nhan: "Thu chi",
    phu: "Ghi khoản thu, chi",
    href: "/{store}/cash/new",
    Icon: WalletIcon,
    khung: "bg-nen-emerald border-vien-emerald text-chu-emerald",
    tron: "bg-chu-emerald",
  },
];

/**
 * Tam "Tao nhanh" truot tu day len khi bam nut + giua thanh day dien thoai (sadmin/admin).
 * Bon thao tac xep hai hang hai cot de chu phu khong rot dong tren man 360px.
 */
export function TaoNhanh({ open, onOpenChange, storeCode }: { open: boolean; onOpenChange: (o: boolean) => void; storeCode: string }) {
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-auto bottom-0 left-0 max-w-none translate-x-0 translate-y-0 gap-0 rounded-t-2xl rounded-b-none p-5 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:max-w-none lg:hidden">
        <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
        <div className="border-b pb-3">
          <DialogTitle className="text-base font-bold">Tạo nhanh</DialogTitle>
          <DialogDescription className="text-xs">Việc hay làm trong ngày</DialogDescription>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-4">
          {THAO_TAC.map((t) => (
            <button
              key={t.nhan}
              type="button"
              onClick={() => {
                onOpenChange(false);
                router.push(t.href.replace("{store}", storeCode));
              }}
              className={cn(
                "flex min-h-28 flex-col items-center justify-center rounded-xl border p-3 text-center transition motion-safe:active:scale-95",
                t.khung
              )}
            >
              <span className={cn("mb-2 flex size-11 items-center justify-center rounded-full text-card shadow-sm", t.tron)}>
                <t.Icon className="size-5" aria-hidden />
              </span>
              <span className="text-sm font-bold">{t.nhan}</span>
              <span className="text-xs opacity-80">{t.phu}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
