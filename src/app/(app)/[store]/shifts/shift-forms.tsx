"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { adjustShiftCount, approveShift, closeShift, openShift } from "./actions";
import { formatMoney } from "@/lib/format";
import { MoneyInput } from "@/components/money-input";
import { LuaChon } from "@/components/lua-chon";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
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

export function CloseShiftForm({
  storeCode,
  shiftId,
  expected,
  waitingCount = 0,
  diffAlert,
}: {
  storeCode: string;
  shiftId: string;
  expected: number;
  waitingCount?: number;
  // Nguong shift.diff_alert_amount: lech vuot nguong thi ca chuyen Can kiem tra
  diffAlert: number;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"total" | "denom">("denom");
  const [total, setTotal] = useState<number | null>(null);
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const denomTotal = useMemo(() => DENOMS.reduce((s, d) => s + d * (Number(counts[d]) || 0), 0), [counts]);
  const counted = mode === "denom" ? denomTotal : (total ?? 0);
  const diff = counted - expected;
  const overAlert = Math.abs(diff) > diffAlert;
  const { confirm, dialog } = useConfirm();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "total" && total == null) return void toast.error("Nhập tiền mặt thực đếm");
    if (diff !== 0 && !note.trim()) return void toast.error("Tiền lệch: ghi rõ lý do");
    if (
      !(await confirm({
        title: "Chốt ca?",
        description: `Tiền mặt thực đếm ${formatMoney(counted)}. ${waitingCount > 0 ? `Còn ${waitingCount} khoản thu chi chờ duyệt. ` : ""}Ca đã chốt không mở lại được.`,
      }))
    )
      return;
    start(async () => {
      const res = await closeShift(storeCode, shiftId, counted, note);
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.data?.status === "flagged" ? "Đã chốt ca. Lệch vượt ngưỡng, quản lý sẽ kiểm tra." : "Đã chốt ca");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="@container space-y-3">
      {dialog}
      <LuaChon
        aria-label="Cách nhập tiền đếm"
        className="max-w-sm"
        value={mode}
        onChange={(x) => setMode(x as "total" | "denom")}
        options={[
          { value: "denom", label: "Đếm theo mệnh giá" },
          { value: "total", label: "Nhập tổng" },
        ]}
      />
      {mode === "denom" ? (
        <div className="grid grid-cols-2 gap-2 @md:grid-cols-3">
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
      <div className="grid gap-3 @md:grid-cols-2">
        <dl className="grid grid-cols-2 content-start gap-y-1 rounded-lg bg-muted p-3 text-sm">
          <dt>Tiền mặt kỳ vọng</dt>
          <dd className="text-right tabular-nums">{formatMoney(expected)}</dd>
          <dt>Thực đếm</dt>
          <dd className="text-right tabular-nums">{formatMoney(counted)}</dd>
          <dt className="font-medium">{overAlert ? "Lệch vượt ngưỡng" : "Chênh lệch"}</dt>
          <dd className={`text-right font-medium tabular-nums ${overAlert ? "text-chu-red" : diff !== 0 ? "text-chu-amber" : "text-chu-emerald"}`}>
            {diff > 0 ? "+" : ""}
            {formatMoney(diff)}
          </dd>
        </dl>
        <div className="space-y-1.5">
          <Label htmlFor="close-note">Ghi chú{diff !== 0 ? " (bắt buộc khi lệch)" : ""}</Label>
          <Textarea id="close-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
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
