"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { collectCustomerDebt } from "./actions";
import { baoTheoKetQua } from "@/lib/feedback";
import { formatMoney } from "@/lib/format";
import { MoneyInput } from "@/components/money-input";
import { LuaChon } from "@/components/lua-chon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type MoneyAccount = { id: string; name: string; kind: string };

// Thu no khach (mot phan hoac het) vao tai khoan; dung o chi tiet hoa don va man Cong no
export function CollectDebtButton({
  storeCode,
  debt,
  accounts,
  today,
  size = "default",
}: {
  storeCode: string;
  debt: { id: string; code: string; customer_name: string; remaining: number };
  accounts: MoneyAccount[];
  today: string;
  size?: "default" | "sm";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number | null>(debt.remaining);
  const [account, setAccount] = useState(accounts.length <= 3 ? (accounts[0]?.id ?? "") : "");
  const [paidOn, setPaidOn] = useState(today);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const a = amount ?? 0;

  function onOpenChange(o: boolean) {
    if (o) setAmount(debt.remaining);
    setOpen(o);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await collectCustomerDebt(storeCode, debt.id, { amount: a, account_id: account, paid_on: paidOn, note: note.trim() || null });
      if (baoTheoKetQua(res, `Đã thu nợ ${formatMoney(a)} của ${debt.customer_name}`)) {
        setOpen(false);
        setNote("");
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button size={size} variant="outline" onClick={() => onOpenChange(true)}>
        Thu nợ
      </Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={submit} className="flex min-h-0 flex-col gap-3">
            <DialogHeader>
              <DialogTitle>Thu nợ {debt.customer_name}</DialogTitle>
              <DialogDescription>
                {debt.code} - còn nợ {formatMoney(debt.remaining)}
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="cd-amount">Số tiền thu *</Label>
                <MoneyInput id="cd-amount" value={amount} onChange={setAmount} autoFocus />
                {a > debt.remaining && <p className="text-xs text-chu-red">Lớn hơn số còn nợ</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cd-acc">Tài khoản nhận *</Label>
                {accounts.length === 0 ? (
                  <p className="text-sm text-chu-red">Chưa có tài khoản tiền. Nhờ quản trị thêm ở Cài đặt.</p>
                ) : (
                  <LuaChon
                    id="cd-acc"
                    aria-label="Tài khoản nhận"
                    value={account}
                    onChange={setAccount}
                    options={[
                      ...(accounts.length > 3 ? [{ value: "", label: "Chọn tài khoản" }] : []),
                      ...accounts.map((x) => ({ value: x.id, label: x.name })),
                    ]}
                  />
                )}
                {accounts.find((x) => x.id === account)?.kind === "cash" && (
                  <p className="text-xs text-muted-foreground">Tiền mặt vào két được cộng vào ca đang mở.</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="cd-on">Ngày thu</Label>
                  <Input id="cd-on" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cd-note">Ghi chú</Label>
                  <Input id="cd-note" value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={pending || a <= 0 || a > debt.remaining || !account}>
                {pending ? "Đang lưu..." : `Thu ${formatMoney(a)}`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
