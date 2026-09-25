"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { recordPayment } from "../actions";
import { formatDateVN } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { MoneyInput } from "@/components/money-input";
import { NativeSelect } from "@/components/native-select";
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
  initialSupplier,
  today,
}: {
  storeId: string;
  storeCode: string;
  debts: OpenDebt[];
  initialSupplier: string;
  today: string;
}) {
  const router = useRouter();
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
      <section className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="sup">Nhà cung cấp *</Label>
          <NativeSelect
            id="sup"
            value={supplier}
            onChange={(e) => {
              setSupplier(e.target.value);
              setAmount(null);
              setAlloc({});
            }}
          >
            <option value="">Chọn nhà cung cấp</option>
            {[...suppliers.entries()].map(([id, s]) => (
              <option key={id} value={id}>
                {s.name} - còn nợ {formatMoney(s.remaining)}
              </option>
            ))}
          </NativeSelect>
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
            <div className="space-y-1.5">
              <Label htmlFor="pm">Phương thức</Label>
              <NativeSelect id="pm" value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
                <option value="transfer">Chuyển khoản</option>
                <option value="cash">Tiền mặt</option>
                <option value="other">Khác</option>
              </NativeSelect>
              {method === "cash" && (
                <label className="flex items-center gap-2 pt-1 text-sm">
                  <input type="checkbox" className="size-4" checked={inShift} onChange={(e) => setInShift(e.target.checked)} />
                  Lấy tiền từ két ca đang mở của tôi
                </label>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ref">Số tham chiếu / mã giao dịch</Label>
              <Input id="ref" value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="pnote">Ghi chú</Label>
              <Input id="pnote" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </>
        )}
      </section>

      {supplier && (
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-2 font-medium">Phân bổ vào các khoản nợ</h2>
          <ul className="divide-y">
            {list.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  {d.code} - phát sinh {formatDateVN(d.issued_date)} - hạn {formatDateVN(d.due_date)}
                  <span className="block text-xs text-muted-foreground">Còn nợ {formatMoney(d.remaining)}</span>
                </span>
                <MoneyInput
                  aria-label={`Phân bổ cho ${d.code}`}
                  value={alloc[d.id] ?? null}
                  onChange={(n) => setAlloc({ ...alloc, [d.id]: Math.min(n ?? 0, d.remaining) })}
                  className="w-40"
                />
              </li>
            ))}
          </ul>
          <p className={`mt-2 text-sm ${amount && allocSum !== amount ? "text-destructive" : "text-muted-foreground"}`}>
            Đã phân bổ {formatMoney(allocSum)} / {formatMoney(amount ?? 0)}
          </p>
        </section>
      )}
      <Button type="submit" className="h-11 px-6" disabled={pending || !supplier}>
        {pending ? "Đang ghi..." : "Ghi thanh toán"}
      </Button>
    </form>
  );
}
