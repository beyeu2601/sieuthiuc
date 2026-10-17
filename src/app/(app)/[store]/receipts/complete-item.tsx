"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeReceiptItem } from "./actions";
import { baoTheoKetQua } from "@/lib/feedback";
import { formatMoney, formatNumber } from "@/lib/format";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Bo sung gia von / HSD con thieu cho dong cua phieu da nhap kho (sadmin/admin)
export function CompleteItemButton({
  storeCode,
  receiptId,
  item,
}: {
  storeCode: string;
  receiptId: string;
  item: { id: string; name: string; qty: number; unit: string; needCost: boolean; needExpiry: boolean };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cost, setCost] = useState<number | null>(null);
  const [expiry, setExpiry] = useState("");
  const [pending, start] = useTransition();
  const lineTotal = cost != null ? Math.round(item.qty * cost) : 0;
  const ready = (item.needCost && cost != null) || (item.needExpiry && !!expiry);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await completeReceiptItem(storeCode, receiptId, item.id, {
        unit_cost: item.needCost ? cost : null,
        expiry_date: item.needExpiry && expiry ? expiry : null,
      });
      if (baoTheoKetQua(res, `Đã bổ sung ${item.name}`)) {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Bổ sung
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={submit} className="flex min-h-0 flex-col gap-3">
            <DialogHeader>
              <DialogTitle>Bổ sung {item.name}</DialogTitle>
              <DialogDescription>
                {formatNumber(item.qty)} {item.unit}. Có thể bổ sung từng phần, phần còn trống để lần sau.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-3">
              {item.needCost && (
                <div className="space-y-1.5">
                  <Label htmlFor="ci-cost">Đơn giá nhập</Label>
                  <MoneyInput id="ci-cost" value={cost} onChange={setCost} autoFocus />
                  {cost != null && (
                    <p className="text-xs text-muted-foreground tabular-nums">
                      Cộng {formatMoney(lineTotal)} vào phiếu và công nợ NCC; hàng đã bán trước đó giữ giá vốn cũ.
                    </p>
                  )}
                </div>
              )}
              {item.needExpiry && (
                <div className="space-y-1.5">
                  <Label htmlFor="ci-exp">Hạn sử dụng</Label>
                  <Input id="ci-exp" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
                </div>
              )}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={pending || !ready}>
                {pending ? "Đang lưu..." : "Lưu"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
