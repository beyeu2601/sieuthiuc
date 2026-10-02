"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { recordPayout } from "../../actions";
import { formatDateVN } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { MoneyInput } from "@/components/money-input";
import { LuaChon } from "@/components/lua-chon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type UnpaidOrder = {
  id: string;
  code: string;
  external_order_id: string | null;
  customer_name: string | null;
  amount: number;
  delivered_at: string | null;
};

const LAST_ACCOUNT_KEY = "sieuthiuc.payout.account";

export function PayoutForm({
  storeId,
  storeCode,
  orders,
  accounts,
  today,
}: {
  storeId: string;
  storeCode: string;
  orders: UnpaidOrder[];
  accounts: { id: string; name: string; kind: string }[];
  today: string;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [received, setReceived] = useState<number | null>(null);
  const [ads, setAds] = useState<number | null>(null);
  const [date, setDate] = useState(today);
  const [account, setAccount] = useState(accounts.find((a) => a.kind === "bank")?.id ?? accounts[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  // Nho tai khoan dung lan truoc tren may nay
  useEffect(() => {
    try {
      const last = localStorage.getItem(LAST_ACCOUNT_KEY);
      if (last && accounts.some((a) => a.id === last)) setAccount(last);
    } catch {}
  }, [accounts]);

  const term = q.trim().toLowerCase();
  const shown = term
    ? orders.filter((o) =>
        [o.code, o.external_order_id, o.customer_name].some((v) => v?.toLowerCase().includes(term))
      )
    : orders;
  const total = orders.filter((o) => picked.has(o.id)).reduce((s, o) => s + o.amount, 0);
  const fee = total - (received ?? 0) - (ads ?? 0);
  const allShownPicked = shown.length > 0 && shown.every((o) => picked.has(o.id));

  function toggle(id: string) {
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function toggleShown() {
    setPicked((s) => {
      const n = new Set(s);
      for (const o of shown) {
        if (allShownPicked) n.delete(o.id);
        else n.add(o.id);
      }
      return n;
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (picked.size === 0) return void toast.error("Tick ít nhất một đơn");
    if (received == null) return void toast.error("Nhập số tiền thực nhận");
    if (!account) return void toast.error("Chọn tài khoản nhận tiền");
    start(async () => {
      const res = await recordPayout(storeCode, {
        store_id: storeId,
        account_id: account,
        received_on: date,
        amount_received: received,
        ads_amount: ads ?? 0,
        note: note.trim() || null,
        order_ids: [...picked],
      });
      if (!res.ok) return void toast.error(res.error);
      try {
        localStorage.setItem(LAST_ACCOUNT_KEY, account);
      } catch {}
      toast.success(`Đã ghi đợt ${res.data!.code}`);
      router.push(`/${storeCode}/orders/payouts/${res.data!.id}`);
    });
  }

  if (orders.length === 0)
    return <p className="rounded-xl border bg-card p-4 text-sm">Không có đơn Shopee nào đã giao mà chưa nhận tiền.</p>;

  return (
    <form onSubmit={submit} className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="min-w-0 rounded-xl border bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
            placeholder="Tìm mã đơn Shopee, mã đơn, tên khách"
            aria-label="Tìm đơn"
            className="min-w-0 flex-1"
          />
          <Button type="button" variant="outline" onClick={toggleShown}>
            {allShownPicked ? "Bỏ chọn" : "Chọn"} {term ? "kết quả tìm" : "tất cả"} ({shown.length})
          </Button>
          <p className="w-full text-xs text-muted-foreground">Tick các đơn có trong đợt (Shopee: Tài chính &gt; Doanh thu).</p>
        </div>
        <ul className="max-h-[50vh] divide-y overflow-y-auto">
          {shown.map((o) => (
            <li key={o.id}>
              <label className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50">
                <input
                  type="checkbox"
                  className="size-5 shrink-0 accent-primary"
                  checked={picked.has(o.id)}
                  onChange={() => toggle(o.id)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{o.external_order_id ?? o.code}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {o.code}
                    {o.customer_name ? ` - ${o.customer_name}` : ""}
                    {o.delivered_at ? ` - giao ${formatDateVN(o.delivered_at.slice(0, 10))}` : ""}
                  </span>
                </span>
                <span className="tabular-nums">{formatMoney(o.amount)}</span>
              </label>
            </li>
          ))}
          {shown.length === 0 && <li className="p-3 text-sm text-muted-foreground">Không có đơn khớp.</li>}
        </ul>
      </section>

      <div className="@container min-w-0 space-y-4">
        <section className="grid gap-x-4 gap-y-3 rounded-xl border bg-card p-4 @md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="received">Số tiền thực nhận *</Label>
            <MoneyInput id="received" value={received} onChange={setReceived} className="h-11 text-base" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ads">Shopee trừ nạp quảng cáo</Label>
            <MoneyInput id="ads" value={ads} onChange={setAds} />
            <p className="text-xs text-muted-foreground">Bỏ trống nếu không bật tự nạp quảng cáo từ doanh thu.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pdate">Ngày tiền về</Label>
            <Input id="pdate" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="acc">Tài khoản nhận *</Label>
            <LuaChon
              id="acc"
              aria-label="Tài khoản nhận"
              value={account}
              onChange={setAccount}
              options={[
                // Tu 3 tai khoan tro xuong la nut bam, khong can dong "Chon tai khoan"
                ...(accounts.length > 3 ? [{ value: "", label: "Chọn tài khoản" }] : []),
                ...accounts.map((a) => ({ value: a.id, label: a.name })),
              ]}
            />
          </div>
          <div className="space-y-1.5 @md:col-span-2">
            <Label htmlFor="note">Ghi chú</Label>
            <Textarea id="note" rows={1} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </section>

        <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] rounded-xl border bg-card p-4 shadow-sm lg:bottom-0">
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt>Tổng {picked.size} đơn đã chọn</dt>
            <dd className="text-right tabular-nums">{formatMoney(total)}</dd>
            <dt>Thực nhận</dt>
            <dd className="text-right tabular-nums">-{formatMoney(received ?? 0)}</dd>
            <dt>Quảng cáo</dt>
            <dd className="text-right tabular-nums">-{formatMoney(ads ?? 0)}</dd>
            <dt className="font-semibold">{fee >= 0 ? "Phí sàn" : "Shopee trả dư (ghi Thu khác)"}</dt>
            <dd className="text-right font-semibold tabular-nums">
              {formatMoney(Math.abs(fee))}
              {total > 0 && fee >= 0 && <span className="ml-1 font-normal text-muted-foreground">({((fee / total) * 100).toFixed(1).replace(".", ",")}%)</span>}
            </dd>
          </dl>
          <Button type="submit" disabled={pending} className="mt-3 h-11 w-full">
            {pending ? "Đang ghi..." : "Ghi đợt tiền về"}
          </Button>
        </div>
      </div>
    </form>
  );
}
