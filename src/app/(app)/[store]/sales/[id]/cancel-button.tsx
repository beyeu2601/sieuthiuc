"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cancelSale } from "../actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CancelSaleButton({ storeCode, saleId }: { storeCode: string; saleId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Hủy giao dịch
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hủy giao dịch</DialogTitle>
            <DialogDescription>Hàng được trả lại đúng lô đã xuất. Giao dịch không còn tính doanh thu.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reason">Lý do hủy *</Label>
            <Textarea id="reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Không hủy
            </Button>
            <Button
              variant="destructive"
              disabled={pending || !reason.trim()}
              onClick={() =>
                start(async () => {
                  const res = await cancelSale(storeCode, saleId, reason);
                  if (!res.ok) return void toast.error(res.error);
                  toast.success("Đã hủy giao dịch");
                  setOpen(false);
                  router.refresh();
                })
              }
            >
              Xác nhận hủy
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
