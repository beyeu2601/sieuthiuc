"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PencilIcon } from "lucide-react";
import { updateSale } from "../actions";
import type { MoneyAccount } from "../collect-debt";
import { baoThanhCong } from "@/lib/feedback";
import { formatMoney } from "@/lib/format";
import { MoneyInput } from "@/components/money-input";
import { LuaChon } from "@/components/lua-chon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Method = "cash" | "transfer" | "other";
const METHODS: { m: Method; label: string }[] = [
  { m: "cash", label: "Tiền mặt" },
  { m: "transfer", label: "Chuyển khoản" },
  { m: "other", label: "Khác" },
];

export type SaleEditValues = {
  orderDiscount: number;
  discountNote: string;
  note: string;
  pay: Record<Method, { amount: number | null; account: string }>;
  debt: number | null;
  debtName: string;
  debtPhone: string;
};

// Sua giao dich tai quay: giam gia don, thanh toan, ghi no, ghi chu. Dong san pham khong sua.
export function EditSale({
  storeCode,
  sale,
  accounts,
}: {
  storeCode: string;
  sale: { id: string; code: string; subtotal: number; lineDiscount: number; debtPaid: number; values: SaleEditValues };
  accounts: MoneyAccount[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [h, setH] = useState(sale.values);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(h) !== JSON.stringify(sale.values);
  const total = sale.subtotal - sale.lineDiscount - (h.orderDiscount ?? 0);
  const entered = METHODS.reduce((s, x) => s + (h.pay[x.m].amount ?? 0), 0) + (h.debt ?? 0);

  function onOpenChange(o: boolean) {
    if (o) {
      setH(sale.values);
      setError(null);
    }
    setOpen(o);
  }

  const setPay = (m: Method, patch: Partial<{ amount: number | null; account: string }>) =>
    setH((v) => ({ ...v, pay: { ...v.pay, [m]: { ...v.pay[m], ...patch } } }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (entered !== total) return setError(`Tiền thanh toán ${formatMoney(entered)} chưa bằng tổng ${formatMoney(total)}`);
    if ((h.debt ?? 0) > 0 && !h.debtName.trim()) return setError("Nhập tên khách ghi nợ");
    const payments = METHODS.filter((x) => (h.pay[x.m].amount ?? 0) > 0).map((x) => ({
      method: x.m,
      amount: h.pay[x.m].amount!,
      account_id: h.pay[x.m].account || null,
    }));
    if (accounts.length > 0 && payments.some((p) => !p.account_id)) return setError("Chọn tài khoản cho từng phương thức");
    start(async () => {
      const res = await updateSale(storeCode, sale.id, {
        discount_amount: h.orderDiscount ?? 0,
        discount_note: h.discountNote.trim() || null,
        note: h.note.trim() || null,
        payments,
        debt: (h.debt ?? 0) > 0 ? { amount: h.debt!, customer_name: h.debtName.trim(), customer_phone: h.debtPhone.trim() || null } : null,
      });
      if (!res.ok) return setError(res.error);
      baoThanhCong(`Đã sửa hóa đơn ${sale.code}`);
      setOpen(false);
      router.refresh();
    });
  }

  const accOptions = [...(accounts.length > 3 ? [{ value: "", label: "Chọn tài khoản" }] : []), ...accounts.map((a) => ({ value: a.id, label: a.name }))];

  return (
    <>
      <Button variant="outline" onClick={() => onOpenChange(true)}>
        <PencilIcon />
        Sửa đơn
      </Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <form onSubmit={submit} className="flex min-h-0 flex-col gap-3">
            <DialogHeader>
              <DialogTitle>Sửa hóa đơn {sale.code}</DialogTitle>
            </DialogHeader>
            <DialogBody className="@container space-y-3">
              {error && (
                <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
              <div className="grid gap-x-4 gap-y-3 @md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="s-disc">Giảm giá đơn</Label>
                  <MoneyInput id="s-disc" value={h.orderDiscount} onChange={(n) => setH({ ...h, orderDiscount: n ?? 0 })} />
                  {sale.lineDiscount > 0 && <p className="text-xs text-muted-foreground">Đã giảm theo dòng {formatMoney(sale.lineDiscount)} (không đổi)</p>}
                </div>
                {sale.lineDiscount + (h.orderDiscount ?? 0) > 0 && (
                  <div className="space-y-1.5">
                    <Label htmlFor="s-dnote">Lý do giảm</Label>
                    <Input id="s-dnote" value={h.discountNote} onChange={(e) => setH({ ...h, discountNote: e.target.value })} />
                  </div>
                )}
              </div>

              <div className="grid gap-x-4 gap-y-3 border-t pt-3 @md:grid-cols-2">
                {METHODS.map((x) => (
                  <div key={x.m} className="space-y-1.5">
                    <Label htmlFor={`s-${x.m}`}>{x.label}</Label>
                    <MoneyInput
                      id={`s-${x.m}`}
                      value={h.pay[x.m].amount}
                      onChange={(n) =>
                        setPay(x.m, { amount: n, account: n && !h.pay[x.m].account && accounts.length <= 3 ? (accounts[0]?.id ?? "") : h.pay[x.m].account })
                      }
                    />
                    {accounts.length > 0 && (h.pay[x.m].amount ?? 0) > 0 && (
                      <LuaChon aria-label={`Tài khoản ${x.label}`} value={h.pay[x.m].account} onChange={(v) => setPay(x.m, { account: v })} options={accOptions} />
                    )}
                  </div>
                ))}
                <div className="space-y-1.5">
                  <Label htmlFor="s-debt">Ghi nợ (trả sau)</Label>
                  <MoneyInput id="s-debt" value={h.debt} onChange={(n) => setH({ ...h, debt: n })} disabled={sale.debtPaid > 0} />
                  {sale.debtPaid > 0 && <p className="text-xs text-muted-foreground">Khách đã trả {formatMoney(sale.debtPaid)}, không đổi số nợ</p>}
                </div>
                {(h.debt ?? 0) > 0 && (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="s-dname">Tên khách nợ *</Label>
                      <Input id="s-dname" value={h.debtName} onChange={(e) => setH({ ...h, debtName: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="s-dphone">Điện thoại khách</Label>
                      <Input id="s-dphone" type="tel" inputMode="tel" value={h.debtPhone} onChange={(e) => setH({ ...h, debtPhone: e.target.value })} />
                    </div>
                  </>
                )}
                <div className="space-y-1.5 @md:col-span-2">
                  <Label htmlFor="s-note">Ghi chú</Label>
                  <Textarea id="s-note" rows={2} value={h.note} onChange={(e) => setH({ ...h, note: e.target.value })} />
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-y-1 border-t pt-3 text-sm tabular-nums">
                <dt>Tổng sau sửa</dt>
                <dd className="text-right font-semibold">{formatMoney(total)}</dd>
                <dt>Đã nhập thanh toán</dt>
                <dd className={`text-right ${entered !== total ? "text-chu-red" : ""}`}>{formatMoney(entered)}</dd>
              </dl>
            </DialogBody>
            <DialogFooter className="items-center">
              {dirty && <span className="text-xs text-chu-amber sm:mr-auto">Có thay đổi chưa lưu</span>}
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={pending || !dirty}>
                {pending ? "Đang lưu..." : "Lưu"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
