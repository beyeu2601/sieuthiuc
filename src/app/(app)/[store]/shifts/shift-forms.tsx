"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { adjustShiftCount, approveShift, closeShift, openShift } from "./actions";
import { formatMoney } from "@/lib/format";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function OpenShiftForm({ storeCode, storeId, redirectTo }: { storeCode: string; storeId: string; redirectTo?: string }) {
  const router = useRouter();
  const [cash, setCash] = useState<number | null>(null);
  const [pending, start] = useTransition();
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (cash == null) return void toast.error("Nhập tiền mặt đầu ca (0 nếu két trống)");
    start(async () => {
      const res = await openShift(storeCode, storeId, cash);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Đã mở ca");
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });
  }
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <div className="space-y-1.5">
        <Label htmlFor="opening">Tiền mặt đầu ca (đếm trong két)</Label>
        <MoneyInput id="opening" value={cash} onChange={setCash} className="h-11 w-52 text-base" autoFocus />
      </div>
      <Button type="submit" className="h-11 px-6" disabled={pending}>
        {pending ? "Đang mở..." : "Mở ca"}
      </Button>
    </form>
  );
}

const DENOMS = [500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000];

export function CloseShiftForm({ storeCode, shiftId, expected }: { storeCode: string; shiftId: string; expected: number }) {
  const router = useRouter();
  const [mode, setMode] = useState<"total" | "denom">("denom");
  const [total, setTotal] = useState<number | null>(null);
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const denomTotal = useMemo(() => DENOMS.reduce((s, d) => s + d * (Number(counts[d]) || 0), 0), [counts]);
  const counted = mode === "denom" ? denomTotal : (total ?? 0);
  const diff = counted - expected;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "total" && total == null) return void toast.error("Nhập tiền mặt thực đếm");
    if (diff !== 0 && !note.trim()) return void toast.error("Tiền lệch: ghi rõ lý do");
    if (!confirm(`Chốt ca với tiền mặt thực đếm ${formatMoney(counted)}? Ca đã chốt không mở lại được.`)) return;
    start(async () => {
      const res = await closeShift(storeCode, shiftId, counted, note);
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.data?.status === "flagged" ? "Đã chốt ca. Lệch vượt ngưỡng, quản lý sẽ kiểm tra." : "Đã chốt ca");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex gap-1" role="group" aria-label="Cách nhập tiền đếm">
        <Button type="button" size="sm" variant={mode === "denom" ? "default" : "outline"} onClick={() => setMode("denom")}>
          Đếm theo mệnh giá
        </Button>
        <Button type="button" size="sm" variant={mode === "total" ? "default" : "outline"} onClick={() => setMode("total")}>
          Nhập tổng
        </Button>
      </div>
      {mode === "denom" ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {DENOMS.map((d) => (
            <label key={d} className="flex items-center gap-2 text-sm">
              <span className="w-20 text-right tabular-nums">{new Intl.NumberFormat("vi-VN").format(d)}</span>
              <span aria-hidden>x</span>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                aria-label={`Số tờ ${d}`}
                value={counts[d] ?? ""}
                onChange={(e) => setCounts({ ...counts, [d]: e.target.value })}
                className="h-10 w-20"
              />
            </label>
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="counted">Tiền mặt thực đếm</Label>
          <MoneyInput id="counted" value={total} onChange={setTotal} className="h-11 w-52 text-base" />
        </div>
      )}
      <dl className="grid max-w-sm grid-cols-2 gap-y-1 rounded-lg bg-muted p-3 text-sm">
        <dt>Tiền mặt kỳ vọng</dt>
        <dd className="text-right tabular-nums">{formatMoney(expected)}</dd>
        <dt>Thực đếm</dt>
        <dd className="text-right tabular-nums">{formatMoney(counted)}</dd>
        <dt className="font-medium">Chênh lệch</dt>
        <dd className={`text-right font-medium tabular-nums ${diff < 0 ? "text-red-700" : diff > 0 ? "text-amber-700" : "text-green-700"}`}>
          {diff > 0 ? "+" : ""}
          {formatMoney(diff)}
        </dd>
      </dl>
      <div className="space-y-1.5">
        <Label htmlFor="close-note">Ghi chú{diff !== 0 ? " (bắt buộc khi lệch)" : ""}</Label>
        <Textarea id="close-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <Button type="submit" className="h-11 px-6" disabled={pending}>
        {pending ? "Đang chốt..." : "Chốt ca"}
      </Button>
    </form>
  );
}

export function ApproveShiftForm({ storeCode, shiftId }: { storeCode: string; shiftId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-60 flex-1 space-y-1.5">
        <Label htmlFor="approve-note">Ghi chú kiểm tra</Label>
        <Input id="approve-note" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await approveShift(storeCode, shiftId, note);
            if (!res.ok) return void toast.error(res.error);
            toast.success("Đã duyệt ca");
            router.refresh();
          })
        }
      >
        Duyệt ca
      </Button>
    </div>
  );
}

export function AdjustCountForm({ storeCode, shiftId, current }: { storeCode: string; shiftId: string; current: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<number | null>(current);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  if (!open)
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Sửa số tiền đếm
      </Button>
    );
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
      <div className="space-y-1.5">
        <Label htmlFor="adj">Số tiền đếm đúng</Label>
        <MoneyInput id="adj" value={v} onChange={setV} className="w-44" />
      </div>
      <div className="min-w-48 flex-1 space-y-1.5">
        <Label htmlFor="adj-reason">Lý do sửa *</Label>
        <Input id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <Button
        disabled={pending || v == null || !reason.trim()}
        onClick={() =>
          start(async () => {
            const res = await adjustShiftCount(storeCode, shiftId, v ?? 0, reason);
            if (!res.ok) return void toast.error(res.error);
            toast.success("Đã sửa số tiền đếm");
            setOpen(false);
            router.refresh();
          })
        }
      >
        Lưu
      </Button>
    </div>
  );
}
