"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { recordPayment } from "./actions";
import { DUE } from "./labels";
import { formatDateVN } from "@/lib/dates";
import { formatMoney, formatNumber } from "@/lib/format";
import { MoneyInput } from "@/components/money-input";
import { LuaChon } from "@/components/lua-chon";
import { ChipSac } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type DebtItem = { name: string; qty: number; unit: string; unit_cost: number; line_total: number };

export type DebtCardData = {
  id: string;
  code: string;
  supplier_id: string;
  supplier_name: string;
  receipt_id: string | null;
  receipt_code: string | null;
  issued_date: string;
  due_date: string | null;
  // so ngay toi han (am la da qua han), null khi khong co han
  days_left: number | null;
  due: keyof typeof DUE;
  total_amount: number;
  paid_amount: number;
  remaining: number;
  items: DebtItem[];
  extra_cost: number;
  paid_at_receipt: number;
};

type Account = { id: string; name: string; kind: string };
type Method = "cash" | "transfer" | "other";

const ITEMS_SHOWN = 4;

function dueText(d: DebtCardData) {
  if (d.remaining <= 0 || d.days_left == null) return null;
  if (d.days_left < 0) return `quá ${-d.days_left} ngày`;
  if (d.days_left === 0) return "đến hạn hôm nay";
  return `còn ${d.days_left} ngày`;
}

// Danh sach the cong no: moi the la mot khoan no kem mat hang cua phieu nhap.
// Chon nhieu khoan cung nha cung cap de tra mot lan (mot lan tra la mot chung tu cho mot NCC).
export function DebtBoard({
  storeId,
  storeCode,
  debts,
  accounts,
  today,
}: {
  storeId: string;
  storeCode: string;
  debts: DebtCardData[];
  accounts: Account[];
  today: string;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [payIds, setPayIds] = useState<string[] | null>(null);
  const byId = new Map(debts.map((d) => [d.id, d]));
  const selDebts = selected.map((id) => byId.get(id)).filter((d): d is DebtCardData => !!d && d.remaining > 0);
  const selSupplier = selDebts[0]?.supplier_id ?? null;
  const selTotal = selDebts.reduce((s, d) => s + d.remaining, 0);

  // Nhom theo nha cung cap, nhom co han tra gan nhat len truoc
  const groups = new Map<string, { name: string; debts: DebtCardData[] }>();
  for (const d of debts) {
    const g = groups.get(d.supplier_id) ?? { name: d.supplier_name, debts: [] };
    g.debts.push(d);
    groups.set(d.supplier_id, g);
  }

  function toggle(d: DebtCardData) {
    setSelected((s) => (s.includes(d.id) ? s.filter((x) => x !== d.id) : [...s, d.id]));
  }
  function toggleGroup(ids: string[], on: boolean) {
    setSelected((s) => (on ? [...new Set([...s, ...ids])] : s.filter((x) => !ids.includes(x))));
  }

  return (
    <div className="space-y-5">
      {[...groups.entries()].map(([sid, g]) => {
        const openIds = g.debts.filter((d) => d.remaining > 0).map((d) => d.id);
        const owed = g.debts.reduce((s, d) => s + d.remaining, 0);
        const locked = selSupplier !== null && selSupplier !== sid;
        const allOn = openIds.length > 0 && openIds.every((id) => selected.includes(id));
        return (
          <section key={sid} aria-label={`Công nợ ${g.name}`} className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className={cn("flex min-h-11 items-center gap-3 text-base font-semibold", openIds.length > 0 && !locked && "cursor-pointer")}>
                {openIds.length > 0 && (
                  <input
                    type="checkbox"
                    className="size-5 accent-primary"
                    checked={allOn}
                    disabled={locked}
                    onChange={(e) => toggleGroup(openIds, e.target.checked)}
                    aria-label={`Chọn tất cả khoản còn nợ của ${g.name}`}
                  />
                )}
                {g.name}
              </label>
              <span className="text-sm text-muted-foreground">
                {g.debts.length} khoản - còn nợ <strong className="text-foreground tabular-nums">{formatMoney(owed)}</strong>
              </span>
            </div>
            <ul className="space-y-2">
              {g.debts.map((d) => (
                <DebtCard
                  key={d.id}
                  d={d}
                  storeCode={storeCode}
                  checked={selected.includes(d.id)}
                  locked={locked}
                  onToggle={() => toggle(d)}
                  onPay={() => setPayIds([d.id])}
                />
              ))}
            </ul>
          </section>
        );
      })}

      {selDebts.length > 0 && (
        <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-sm lg:bottom-0">
          <div className="text-sm" aria-live="polite" title="Mỗi lần trả chỉ gộp các khoản cùng nhà cung cấp">
            Đã chọn <strong>{selDebts.length}</strong> khoản của {selDebts[0].supplier_name}:{" "}
            <strong className="tabular-nums">{formatMoney(selTotal)}</strong>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setSelected([])}>
              Bỏ chọn
            </Button>
            <Button onClick={() => setPayIds(selDebts.map((d) => d.id))}>Thanh toán {selDebts.length} khoản</Button>
          </div>
        </div>
      )}

      {payIds && (
        <PayDialog
          key={payIds.join(",")}
          storeId={storeId}
          storeCode={storeCode}
          debts={payIds.map((id) => byId.get(id)!).filter(Boolean)}
          accounts={accounts}
          today={today}
          onClose={() => setPayIds(null)}
          onDone={(ids) => setSelected((s) => s.filter((x) => !ids.includes(x)))}
        />
      )}
    </div>
  );
}

function DebtCard({
  d,
  storeCode,
  checked,
  locked,
  onToggle,
  onPay,
}: {
  d: DebtCardData;
  storeCode: string;
  checked: boolean;
  locked: boolean;
  onToggle: () => void;
  onPay: () => void;
}) {
  const ds = DUE[d.due];
  const open = d.remaining > 0;
  const extraItems = d.items.length - ITEMS_SHOWN;
  const due = dueText(d);
  return (
    <li
      className={cn(
        "grid gap-x-4 gap-y-2 rounded-xl border bg-card p-3 md:grid-cols-[auto_minmax(0,13rem)_minmax(0,1fr)_auto] md:items-start",
        checked && "border-primary ring-1 ring-primary",
        d.due === "overdue" && !checked && "border-vien-red"
      )}
    >
      {/* Cot chon */}
      <div className="flex items-start gap-3 md:contents">
        <div className="pt-0.5">
          {open ? (
            <input
              type="checkbox"
              className="size-5 accent-primary disabled:opacity-40"
              checked={checked}
              disabled={locked}
              onChange={onToggle}
              aria-label={`Chọn khoản ${d.code}`}
              title={locked ? "Chỉ gộp các khoản cùng nhà cung cấp" : undefined}
            />
          ) : (
            <span className="block size-5" aria-hidden />
          )}
        </div>
        {/* Ngay ghi no, han tra, ma */}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold tabular-nums">{formatDateVN(d.issued_date)}</span>
            <ChipSac sac={ds.sac}>{ds.label}</ChipSac>
          </div>
          <div className={cn("text-sm", d.due === "overdue" ? "font-medium text-chu-red" : d.due === "due_soon" ? "text-chu-amber" : "text-muted-foreground")}>
            Hạn trả {formatDateVN(d.due_date)}
            {due && ` - ${due}`}
          </div>
          <div className="text-xs text-muted-foreground">
            {d.receipt_id ? (
              <Link href={`/${storeCode}/receipts/${d.receipt_id}`} className="underline underline-offset-4 hover:text-foreground">
                {d.receipt_code}
              </Link>
            ) : (
              "Không gắn phiếu nhập"
            )}{" "}
            - {d.code}
          </div>
        </div>
      </div>

      {/* Mat hang */}
      <div className="min-w-0 rounded-lg bg-muted/50 px-3 py-2 text-sm md:bg-transparent md:p-0">
        {d.items.length === 0 ? (
          <p className="text-muted-foreground">Không có chi tiết mặt hàng.</p>
        ) : (
          <ul className="space-y-0.5">
            {d.items.slice(0, ITEMS_SHOWN).map((it, i) => (
              <ItemLine key={i} it={it} />
            ))}
          </ul>
        )}
        {extraItems > 0 && (
          <details className="mt-0.5">
            <summary className="cursor-pointer py-1 text-xs text-primary">Xem thêm {extraItems} mặt hàng</summary>
            <ul className="space-y-0.5">
              {d.items.slice(ITEMS_SHOWN).map((it, i) => (
                <ItemLine key={i} it={it} />
              ))}
            </ul>
          </details>
        )}
        {(d.extra_cost > 0 || d.paid_at_receipt > 0) && (
          <div className="mt-1 space-y-0.5 border-t pt-1 text-xs text-muted-foreground">
            {d.extra_cost > 0 && (
              <div className="flex justify-between gap-2">
                <span>Chi phí kèm theo</span>
                <span className="tabular-nums">{formatMoney(d.extra_cost)}</span>
              </div>
            )}
            {d.paid_at_receipt > 0 && (
              <div className="flex justify-between gap-2">
                <span>Đã trả khi nhập hàng</span>
                <span className="tabular-nums">-{formatMoney(d.paid_at_receipt)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* So tien va nut tra */}
      <div className="flex items-end justify-between gap-3 md:flex-col md:items-end md:text-right">
        <div>
          <div className="text-xs text-muted-foreground">{open ? "Còn nợ" : "Đã trả đủ"}</div>
          <div className={cn("text-lg font-semibold tabular-nums", d.due === "overdue" && "text-chu-red")}>{formatMoney(open ? d.remaining : d.total_amount)}</div>
          {open && d.paid_amount > 0 && (
            <div className="text-xs text-muted-foreground tabular-nums">
              đã trả {formatMoney(d.paid_amount)} / {formatMoney(d.total_amount)}
            </div>
          )}
        </div>
        {open && (
          <Button size="sm" variant={checked ? "outline" : "default"} onClick={onPay} className="h-10 md:h-9">
            Thanh toán
          </Button>
        )}
      </div>
    </li>
  );
}

function ItemLine({ it }: { it: DebtItem }) {
  return (
    <li className="flex items-baseline justify-between gap-3">
      <span className="min-w-0">
        <span className="break-words">{it.name}</span>{" "}
        <span className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
          {formatNumber(it.qty)} {it.unit} x {formatMoney(it.unit_cost)}
        </span>
      </span>
      <span className="shrink-0 tabular-nums">{formatMoney(it.line_total)}</span>
    </li>
  );
}

function PayDialog({
  storeId,
  storeCode,
  debts,
  accounts,
  today,
  onClose,
  onDone,
}: {
  storeId: string;
  storeCode: string;
  debts: DebtCardData[];
  accounts: Account[];
  today: string;
  onClose: () => void;
  onDone: (ids: string[]) => void;
}) {
  const router = useRouter();
  const kindForMethod: Record<Method, string> = { cash: "cash", transfer: "bank", other: "ewallet" };
  const pickAccount = (m: Method) => accounts.find((a) => a.kind === kindForMethod[m])?.id ?? accounts[0]?.id ?? "";
  const [alloc, setAlloc] = useState<Record<string, number | null>>(() => Object.fromEntries(debts.map((d) => [d.id, d.remaining])));
  const [method, setMethod] = useState<Method>("transfer");
  const [account, setAccount] = useState(pickAccount("transfer"));
  const [date, setDate] = useState(today);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [inShift, setInShift] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const amount = debts.reduce((s, d) => s + (alloc[d.id] ?? 0), 0);
  const owed = debts.reduce((s, d) => s + d.remaining, 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (amount <= 0) return setError("Nhập số tiền trả");
    if (accounts.length > 0 && !account) return setError("Chọn tài khoản giữ tiền");
    start(async () => {
      const res = await recordPayment(storeCode, {
        store_id: storeId,
        supplier_id: debts[0].supplier_id,
        amount,
        method,
        payment_date: date,
        reference: reference || null,
        note: note || null,
        record_in_shift: inShift && method === "cash",
        account_id: account || null,
        allocations: debts.filter((d) => (alloc[d.id] ?? 0) > 0).map((d) => ({ debt_id: d.id, amount: alloc[d.id]! })),
      });
      if (!res.ok) return setError(res.error);
      toast.success(`Đã ghi thanh toán ${res.data!.code}: ${formatMoney(amount)}`);
      onDone(debts.map((d) => d.id));
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="flex min-h-0 flex-col gap-3">
          <DialogHeader>
            <DialogTitle>Thanh toán cho {debts[0].supplier_name}</DialogTitle>
            <DialogDescription>
              {debts.length} khoản, còn nợ {formatMoney(owed)}. Sửa số tiền từng khoản nếu trả một phần.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            {error && (
              <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <ul className="divide-y rounded-lg border">
              {debts.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium tabular-nums">{formatDateVN(d.issued_date)}</span>
                    <span className="text-muted-foreground"> - {d.receipt_code ?? d.code}</span>
                    <span className="block text-xs text-muted-foreground">
                      Còn nợ {formatMoney(d.remaining)} - hạn {formatDateVN(d.due_date)}
                    </span>
                  </span>
                  <MoneyInput
                    aria-label={`Số tiền trả cho ${d.code}`}
                    value={alloc[d.id] ?? null}
                    onChange={(n) => setAlloc((a) => ({ ...a, [d.id]: n == null ? null : Math.min(n, d.remaining) }))}
                    className="h-10 w-36"
                  />
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
              <span className="text-sm">Tổng trả</span>
              <span className="text-lg font-semibold tabular-nums">{formatMoney(amount)}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="dp-method">Phương thức</Label>
                <LuaChon
                  id="dp-method"
                  aria-label="Phương thức"
                  value={method}
                  onChange={(x) => {
                    const m = x as Method;
                    setMethod(m);
                    setAccount(pickAccount(m));
                  }}
                  options={[
                    { value: "transfer", label: "Chuyển khoản" },
                    { value: "cash", label: "Tiền mặt" },
                    { value: "other", label: "Khác" },
                  ]}
                />
              </div>
              {accounts.length > 0 && (
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="dp-acc">Tài khoản giữ tiền *</Label>
                  <LuaChon
                    id="dp-acc"
                    aria-label="Tài khoản giữ tiền"
                    value={account}
                    onChange={setAccount}
                    options={[
                      // It tai khoan thi hien nut bam, khong can dong "Chon tai khoan"
                      ...(accounts.length > 3 ? [{ value: "", label: "Chọn tài khoản" }] : []),
                      ...accounts.map((a) => ({ value: a.id, label: a.name })),
                    ]}
                  />
                </div>
              )}
              {method === "cash" && (
                <label className="col-span-2 flex min-h-10 items-center gap-2 text-sm">
                  <input type="checkbox" className="size-5" checked={inShift} onChange={(e) => setInShift(e.target.checked)} />
                  Lấy tiền từ két ca đang mở của tôi
                </label>
              )}
              <div className="col-span-2 space-y-1.5 sm:col-span-1">
                <Label htmlFor="dp-date">Ngày trả</Label>
                <Input id="dp-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="col-span-2 space-y-1.5 sm:col-span-1">
                <Label htmlFor="dp-ref">Mã giao dịch</Label>
                <Input id="dp-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="dp-note">Ghi chú</Label>
                <Input id="dp-note" value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={pending || amount <= 0}>
              {pending ? "Đang ghi..." : `Ghi thanh toán ${formatMoney(amount)}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
