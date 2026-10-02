"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { recordPayment } from "../actions";
import { formatDateVN } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { MoneyInput } from "@/components/money-input";
import { LuaChon } from "@/components/lua-chon";
import { Khoi } from "@/components/khoi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type OpenDebt = {
  id: string;
  code: string;
  supplier_id: string;
  supplier_name: string;
  issued_date: string;
  due_date: string | null;
  remaining: number;
};

function autoAllocate(debts: OpenDebt[], amount: number) {
  let left = amount;
  const r: Record<string, number> = {};
  for (const d of debts) {
    const a = Math.min(left, d.remaining);
    r[d.id] = a;
    left -= a;
  }
  return r;
}

export function PaymentForm({
  storeId,
  storeCode,
  debts,
  accounts,
  initialSupplier,
  today,
}: {
  storeId: string;
  storeCode: string;
  debts: OpenDebt[];
  accounts: { id: string; name: string; kind: string }[];
  initialSupplier: string;
  today: string;
}) {
  const router = useRouter();
  const kindForMethod: Record<"cash" | "transfer" | "other", string> = { cash: "cash", transfer: "bank", other: "ewallet" };
  const pickAccount = (m: "cash" | "transfer" | "other") => accounts.find((a) => a.kind === kindForMethod[m])?.id ?? accounts[0]?.id ?? "";
  const suppliers = useMemo(() => {
    const m = new Map<string, { name: string; remaining: number }>();
    for (const d of debts) {
      const s = m.get(d.supplier_id) ?? { name: d.supplier_name, remaining: 0 };
      s.remaining += d.remaining;
      m.set(d.supplier_id, s);
    }
    return m;
  }, [debts]);
  const [supplier, setSupplier] = useState(suppliers.has(initialSupplier) ? initialSupplier : "");
  const list = debts.filter((d) => d.supplier_id === supplier);
  const owed = list.reduce((s, d) => s + d.remaining, 0);
  const [amount, setAmount] = useState<number | null>(null);
  const [alloc, setAlloc] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<"cash" | "transfer" | "other">("transfer");
  const [account, setAccount] = useState<string>(pickAccount("transfer"));
  const [date, setDate] = useState(today);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [inShift, setInShift] = useState(false);
  const [pending, start] = useTransition();
  const allocSum = Object.values(alloc).reduce((s, a) => s + (a || 0), 0);

  function changeAmount(n: number | null) {
    setAmount(n);
    setAlloc(autoAllocate(list, n ?? 0));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supplier) return void toast.error("Chọn nhà cung cấp");
    if (!amount || amount <= 0) return void toast.error("Nhập số tiền");
    if (amount > owed) return void toast.error(`Số tiền vượt tổng còn nợ ${formatMoney(owed)}`);
    if (allocSum !== amount) return void toast.error("Tổng phân bổ phải bằng số tiền thanh toán");
    if (accounts.length > 0 && !account) return void toast.error("Chọn tài khoản giữ tiền");
    start(async () => {
      const res = await recordPayment(storeCode, {
        store_id: storeId,
        supplier_id: supplier,
        amount,
        method,
        payment_date: date,
        reference: reference || null,
        note: note || null,
        record_in_shift: inShift && method === "cash",
        account_id: account || null,
        allocations: Object.entries(alloc)
          .filter(([, a]) => a > 0)
          .map(([debt_id, a]) => ({ debt_id, amount: a })),
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Đã ghi thanh toán ${res.data!.code}`);
      router.push(`/${storeCode}/payables?tab=payments`);
    });
  }

  if (suppliers.size === 0) return <p className="rounded-xl border bg-card p-4 text-sm">Không có khoản nợ nào cần thanh toán.</p>;

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="@container min-w-0 rounded-xl border bg-card p-4">
          <div className="grid gap-x-4 gap-y-3 @md:grid-cols-2 @3xl:grid-cols-4">
            <div className="space-y-1.5 @md:col-span-2">
              <Label htmlFor="sup">Nhà cung cấp *</Label>
              <LuaChon
                id="sup"
                aria-label="Nhà cung cấp"
                value={supplier}
                onChange={(x) => {
                  setSupplier(x);
                  setAmount(null);
                  setAlloc({});
                }}
                options={
                  // It nha cung cap thi hien nut bam ten ngan; so con no hien o khoi Phan bo
                  suppliers.size > 3
                    ? [
                        { value: "", label: "Chọn nhà cung cấp" },
                        ...[...suppliers.entries()].map(([id, s]) => ({ value: id, label: `${s.name} - còn nợ ${formatMoney(s.remaining)}` })),
                      ]
                    : [...suppliers.entries()].map(([id, s]) => ({ value: id, label: s.name }))
                }
              />
            </div>
            {supplier && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="amt">Số tiền trả *</Label>
                  <MoneyInput id="amt" value={amount} onChange={changeAmount} className="h-11 text-base" />
                  <Button type="button" size="sm" variant="outline" onClick={() => changeAmount(owed)}>
                    Trả hết {formatMoney(owed)}
                  </Button>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pdate">Ngày trả</Label>
                  <Input id="pdate" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="space-y-1.5 @md:col-span-2">
                  <Label htmlFor="pm">Phương thức</Label>
                  <LuaChon
                    id="pm"
                    aria-label="Phương thức"
                    value={method}
                    onChange={(x) => {
                      const m = x as typeof method;
                      setMethod(m);
                      setAccount((a) => a || pickAccount(m));
                    }}
                    options={[
                      { value: "transfer", label: "Chuyển khoản" },
                      { value: "cash", label: "Tiền mặt" },
                      { value: "other", label: "Khác" },
                    ]}
                  />
                  {method === "cash" && (
                    <label className="flex min-h-10 items-center gap-2 text-sm">
                      <input type="checkbox" className="size-4" checked={inShift} onChange={(e) => setInShift(e.target.checked)} />
                      Lấy tiền từ két ca đang mở của tôi
                    </label>
                  )}
                </div>
                {accounts.length > 0 && (
                  <div className="space-y-1.5 @md:col-span-2">
                    <Label htmlFor="pacc">Tài khoản giữ tiền *</Label>
                    <LuaChon
                      id="pacc"
                      aria-label="Tài khoản giữ tiền"
                      value={account}
                      onChange={setAccount}
                      options={[
                        ...(accounts.length > 3 ? [{ value: "", label: "Chọn tài khoản" }] : []),
                        ...accounts.map((a) => ({ value: a.id, label: a.name })),
                      ]}
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="ref">Mã giao dịch</Label>
                  <Input id="ref" value={reference} onChange={(e) => setReference(e.target.value)} />
                </div>
                <div className="space-y-1.5 @md:col-span-1 @3xl:col-span-3">
                  <Label htmlFor="pnote">Ghi chú</Label>
                  <Input id="pnote" value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
              </>
            )}
          </div>
        </section>

        {supplier && (
          <Khoi
            title="Phân bổ vào các khoản nợ"
            aside={<span className="text-xs text-muted-foreground tabular-nums">Còn nợ {formatMoney(owed)}</span>}
            className="min-w-0"
          >
            <ul className="divide-y">
              {list.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0">
                    {d.code}
                    <span className="block text-xs text-muted-foreground">
                      Phát sinh {formatDateVN(d.issued_date)} - hạn {formatDateVN(d.due_date)} - còn nợ {formatMoney(d.remaining)}
                    </span>
                  </span>
                  <MoneyInput
                    aria-label={`Phân bổ cho ${d.code}`}
                    value={alloc[d.id] ?? null}
                    onChange={(n) => setAlloc({ ...alloc, [d.id]: Math.min(n ?? 0, d.remaining) })}
                    className="w-36"
                  />
                </li>
              ))}
            </ul>
          </Khoi>
        )}
      </div>
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 flex flex-wrap items-center gap-3 rounded-xl border bg-card/95 px-4 py-3 shadow-sm backdrop-blur lg:bottom-0">
        <Button type="submit" className="h-10 px-5" disabled={pending || !supplier}>
          {pending ? "Đang ghi..." : "Ghi thanh toán"}
        </Button>
        {supplier && (
          <span
            aria-live="polite"
            title="Nhập số tiền thì tự phân bổ khoản cũ trước, sửa được từng khoản"
            className={amount && allocSum !== amount ? "text-sm font-medium text-chu-red" : "text-sm text-muted-foreground"}
          >
            Đã phân bổ {formatMoney(allocSum)} / {formatMoney(amount ?? 0)}
          </span>
        )}
      </div>
    </form>
  );
}
