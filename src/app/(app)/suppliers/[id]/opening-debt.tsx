"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, TrashIcon } from "lucide-react";
import { createOpeningDebt, deleteOpeningDebt } from "../actions";
import { baoTheoKetQua } from "@/lib/feedback";
import { addDaysISO, formatDateVN } from "@/lib/dates";
import { MoneyInput } from "@/components/money-input";
import { LuaChon } from "@/components/lua-chon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConfirm } from "@/components/ui/confirm-dialog";

// Ghi no dau ky: khoan NCC dang cho no tu truoc khi dung app, de ghi thanh toan o man Cong no
export function OpeningDebtButton({
  supplierId,
  termsDays,
  stores,
  today,
}: {
  supplierId: string;
  termsDays: number;
  stores: { id: string; code: string; name: string }[];
  today: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [amount, setAmount] = useState<number | null>(null);
  const [issued, setIssued] = useState(today);
  const [due, setDue] = useState("");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await createOpeningDebt({
        store_id: storeId,
        supplier_id: supplierId,
        amount: amount ?? 0,
        issued_date: issued,
        due_date: due || null,
        note: note.trim() || null,
      });
      if (baoTheoKetQua(res, "Đã ghi nợ đầu kỳ")) {
        setOpen(false);
        setAmount(null);
        setDue("");
        setNote("");
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <PlusIcon /> Ghi nợ
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={submit} className="flex min-h-0 flex-col gap-3">
            <DialogHeader>
              <DialogTitle>Ghi nợ nhà cung cấp</DialogTitle>
              <DialogDescription>Khoản đang nợ từ trước, không có phiếu nhập. Trả nợ ở màn Công nợ.</DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-3">
              {stores.length > 1 && (
                <div className="space-y-1.5">
                  <Label htmlFor="od-store">Cửa hàng</Label>
                  <LuaChon
                    id="od-store"
                    aria-label="Cửa hàng"
                    value={storeId}
                    onChange={setStoreId}
                    options={stores.map((s) => ({ value: s.id, label: s.name }))}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="od-amount">Số tiền nợ *</Label>
                <MoneyInput id="od-amount" value={amount} onChange={setAmount} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="od-issued">Ngày ghi nợ</Label>
                  <Input id="od-issued" type="date" value={issued} onChange={(e) => setIssued(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="od-due">Hạn trả</Label>
                  <Input id="od-due" type="date" min={issued} value={due} onChange={(e) => setDue(e.target.value)} />
                  {!due && issued && (
                    <p className="text-xs text-muted-foreground">Để trống: {termsDays > 0 ? `sau ${termsDays} ngày (${formatDateVN(addDaysISO(issued, termsDays))})` : "trả ngay"}</p>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="od-note">Ghi chú</Label>
                <Input id="od-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nợ đầu kỳ" />
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={pending || !(amount && amount > 0) || !storeId}>
                {pending ? "Đang lưu..." : "Ghi nợ"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Xoa no ghi tay nhap sai (chua tra dong nao)
export function DeleteOpeningDebt({ supplierId, debtId, code }: { supplierId: string; debtId: string; code: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { confirm, dialog } = useConfirm();
  return (
    <>
      {dialog}
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Xóa khoản nợ ${code}`}
        disabled={pending}
        onClick={async () => {
          if (!(await confirm({ title: `Xóa khoản nợ ${code}?`, description: "Chỉ xóa được khoản nợ ghi tay chưa trả đồng nào.", danger: true, confirmLabel: "Xóa" })))
            return;
          start(async () => {
            const res = await deleteOpeningDebt(supplierId, debtId);
            if (baoTheoKetQua(res, "Đã xóa khoản nợ")) router.refresh();
          });
        }}
      >
        <TrashIcon />
      </Button>
    </>
  );
}
