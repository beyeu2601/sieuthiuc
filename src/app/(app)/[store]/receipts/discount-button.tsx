"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addReceiptDiscount } from "./actions";
import { baoTheoKetQua } from "@/lib/feedback";
import { formatMoney } from "@/lib/format";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Ghi chiet khau / thuong NCC cho phieu da xac nhan (khong mo lai duoc vi hang da ban)
export function DiscountButton({
  storeCode,
  receiptId,
  total,
  remaining,
}: {
  storeCode: string;
  receiptId: string;
  total: number;
  remaining: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const a = amount ?? 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await addReceiptDiscount(storeCode, receiptId, a, note);
      if (baoTheoKetQua(res, "Đã ghi chiết khấu")) {
        setOpen(false);
        setAmount(null);
        setNote("");
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Ghi chiết khấu
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={submit} className="flex min-h-0 flex-col gap-3">
            <DialogHeader>
              <DialogTitle>Ghi chiết khấu / thưởng NCC</DialogTitle>
              <DialogDescription>
                {remaining > 0
                  ? "Trừ vào số còn nợ của phiếu."
                  : "Trừ vào khoản đã trả khi nhập (số dư tài khoản tăng lại tương ứng)."}{" "}
                Giá vốn hàng đã nhập giữ nguyên.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="dc-amount">Số tiền chiết khấu *</Label>
                <MoneyInput id="dc-amount" value={amount} onChange={setAmount} autoFocus />
                {a > 0 && <p className="text-xs text-muted-foreground tabular-nums">Tổng phiếu sau chiết khấu {formatMoney(total - a)}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dc-note">Lý do *</Label>
                <Input id="dc-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Vd thưởng chương trình" />
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={pending || a <= 0 || !note.trim()}>
                {pending ? "Đang lưu..." : "Ghi chiết khấu"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
