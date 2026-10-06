"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addDeposit, cancelPreorder, deliverPreorder, markArrived } from "../actions";
import { accountLabel, type MoneyAccount } from "../labels";
import { baoThanhCong, baoTheoKetQua } from "@/lib/feedback";
import type { ActionResult } from "@/lib/errors";
import { formatMoney } from "@/lib/format";
import { MoneyInput } from "@/components/money-input";
import { LuaChon } from "@/components/lua-chon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Kind = "deposit" | "deliver" | "cancel" | null;

function AccountField({ id, label, accounts, value, onChange }: { id: string; label: string; accounts: MoneyAccount[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <LuaChon
        id={id}
        aria-label={label}
        value={value}
        onChange={onChange}
        options={[...(accounts.length > 3 ? [{ value: "", label: "Chọn tài khoản" }] : []), ...accounts.map((a) => ({ value: a.id, label: accountLabel(a) }))]}
      />
      {accounts.find((a) => a.id === value)?.kind === "cash" && <p className="text-xs text-muted-foreground">Tiền mặt ghi vào ca đang mở.</p>}
    </div>
  );
}

export function PreorderActions({
  storeCode,
  id,
  code,
  status,
  subtotal,
  paid,
  accounts,
  today,
  isManager,
}: {
  storeCode: string;
  id: string;
  code: string;
  status: string;
  subtotal: number;
  paid: number;
  accounts: MoneyAccount[];
  today: string;
  isManager: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { confirm, dialog } = useConfirm();
  const [open, setOpen] = useState<Kind>(null);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [account, setAccount] = useState("");
  const [on, setOn] = useState(today);
  const [reason, setReason] = useState("");
  const [choice, setChoice] = useState<"refund" | "keep">("refund");
  const rest = subtotal - paid;

  function show(k: Kind) {
    setError(null);
    setAmount(null);
    setAccount("");
    setOn(today);
    setReason("");
    setChoice("refund");
    setOpen(k);
  }

  function run(fn: () => Promise<ActionResult>, ok: string) {
    start(async () => {
      const res = await fn();
      if (!res.ok) return setError(res.error);
      baoThanhCong(ok);
      setOpen(null);
      router.refresh();
    });
  }

  async function arrived() {
    if (!(await confirm({ title: "Hàng đã về?", description: "Hàng trong đơn được giữ lại trong kho, quầy không bán vượt." }))) return;
    start(async () => {
      const res = await markArrived(storeCode, id);
      if (baoTheoKetQua(res, "Đã ghi hàng về, giữ hàng cho khách")) router.refresh();
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (open === "deposit") {
      if (!amount || amount <= 0) return setError("Nhập số tiền cọc");
      if (amount > rest) return setError(`Tổng cọc không vượt tiền hàng, còn tối đa ${formatMoney(rest)}`);
      if (!account) return setError("Chọn tài khoản nhận cọc");
      run(() => addDeposit(storeCode, id, { amount, account_id: account, paid_on: on, note: null }), "Đã ghi thêm cọc");
    } else if (open === "deliver") {
      if (rest > 0 && !account) return setError("Chọn tài khoản nhận tiền còn lại");
      run(() => deliverPreorder(storeCode, id, rest > 0 ? account : null), "Đã giao hàng, ghi nhận doanh thu");
    } else if (open === "cancel") {
      if (!reason.trim()) return setError("Nhập lý do hủy");
      if (paid > 0 && choice === "refund" && !account) return setError("Chọn tài khoản chi hoàn cọc");
      run(
        () =>
          cancelPreorder(storeCode, id, {
            reason: reason.trim(),
            deposit: paid > 0 ? choice : null,
            account_id: paid > 0 && choice === "refund" ? account : null,
            on,
          }),
        "Đã hủy đơn"
      );
    }
  }

  if (status !== "open" && status !== "arrived") return null;
  // Don co coc: chi quan ly huy (hoan hoac giu coc lien quan tien)
  const canCancel = paid === 0 || isManager;

  return (
    <div className="flex flex-wrap gap-2">
      <Button className="h-10" disabled={pending} onClick={() => show("deliver")}>
        Giao hàng
      </Button>
      {status === "open" && (
        <Button className="h-10" variant="outline" disabled={pending} onClick={arrived}>
          Hàng đã về
        </Button>
      )}
      {rest > 0 && (
        <Button className="h-10" variant="outline" disabled={pending} onClick={() => show("deposit")}>
          Thu thêm cọc
        </Button>
      )}
      {canCancel && (
        <Button className="h-10" variant="ghost" disabled={pending} onClick={() => show("cancel")}>
          Hủy đơn
        </Button>
      )}
      {dialog}
      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={submit} className="flex min-h-0 flex-col gap-3">
            <DialogHeader>
              <DialogTitle>
                {open === "deposit" ? "Thu thêm cọc" : open === "deliver" ? "Giao hàng cho khách" : "Hủy đơn"} {code}
              </DialogTitle>
              <DialogDescription>
                {open === "deliver"
                  ? "Hệ thống ghi doanh thu kênh Đặt trước và trừ kho. Cần đủ hàng trong kho."
                  : open === "cancel"
                    ? "Đơn hủy không mở lại được."
                    : `Đã cọc ${formatMoney(paid)}, còn lại ${formatMoney(rest)}.`}
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-3">
              {error && (
                <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
              {open === "deposit" && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="d-amt">Số tiền cọc thêm</Label>
                    <MoneyInput id="d-amt" autoFocus value={amount} onChange={setAmount} />
                  </div>
                  <AccountField id="d-acc" label="Tài khoản nhận cọc" accounts={accounts} value={account} onChange={setAccount} />
                  <div className="space-y-1.5">
                    <Label htmlFor="d-on">Ngày cọc</Label>
                    <Input id="d-on" type="date" value={on} onChange={(e) => setOn(e.target.value)} />
                  </div>
                </>
              )}
              {open === "deliver" && (
                <>
                  <dl className="grid grid-cols-2 gap-y-1 text-sm tabular-nums">
                    <dt>Tiền hàng</dt>
                    <dd className="text-right">{formatMoney(subtotal)}</dd>
                    <dt>Trừ cọc</dt>
                    <dd className="text-right">-{formatMoney(paid)}</dd>
                    <dt className="font-semibold">Thu thêm của khách</dt>
                    <dd className="text-right text-lg font-semibold">{formatMoney(rest)}</dd>
                  </dl>
                  {rest > 0 && <AccountField id="g-acc" label="Tài khoản nhận tiền còn lại" accounts={accounts} value={account} onChange={setAccount} />}
                </>
              )}
              {open === "cancel" && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="c-reason">Lý do hủy *</Label>
                    <Textarea id="c-reason" rows={2} autoFocus value={reason} onChange={(e) => setReason(e.target.value)} />
                  </div>
                  {paid > 0 && (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor="c-choice">Tiền cọc {formatMoney(paid)}</Label>
                        <LuaChon
                          id="c-choice"
                          aria-label="Xử lý tiền cọc"
                          value={choice}
                          onChange={(v) => setChoice(v as "refund" | "keep")}
                          options={[
                            { value: "refund", label: "Hoàn cọc cho khách" },
                            { value: "keep", label: "Giữ cọc (thu nhập khác)" },
                          ]}
                        />
                      </div>
                      {choice === "refund" && (
                        <AccountField id="c-acc" label="Chi hoàn cọc từ tài khoản" accounts={accounts} value={account} onChange={setAccount} />
                      )}
                      <div className="space-y-1.5">
                        <Label htmlFor="c-on">{choice === "refund" ? "Ngày hoàn cọc" : "Ngày ghi thu nhập"}</Label>
                        <Input id="c-on" type="date" value={on} onChange={(e) => setOn(e.target.value)} />
                      </div>
                    </>
                  )}
                </>
              )}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(null)}>
                Đóng
              </Button>
              <Button type="submit" variant={open === "cancel" ? "destructive" : "default"} disabled={pending}>
                {pending ? "Đang lưu..." : open === "deposit" ? "Ghi cọc" : open === "deliver" ? "Xác nhận giao" : "Hủy đơn"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
