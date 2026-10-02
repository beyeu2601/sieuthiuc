"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adjustProductStock } from "../actions";
import { baoTheoKetQua } from "@/lib/feedback";
import { formatMoney, formatNumber } from "@/lib/format";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type StoreStock = { storeId: string; storeCode: string; qty: number; reserved: number; avgCost: number };

function StoreForm({ productId, s, lotExpiry }: { productId: string; s: StoreStock; lotExpiry: boolean }) {
  const router = useRouter();
  const [qty, setQty] = useState(String(s.qty));
  const [cost, setCost] = useState<number | null>(s.avgCost > 0 ? s.avgCost : null);
  const [expiry, setExpiry] = useState("");
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const newQty = qty === "" ? NaN : Number(qty);
  const delta = Number.isFinite(newQty) ? newQty - s.qty : 0;
  const costChanged = cost != null && cost !== s.avgCost;
  const changed = delta !== 0 || costChanged;
  const id = `stock-${s.storeId}`;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!Number.isFinite(newQty) || newQty < 0) return;
    start(async () => {
      const res = await adjustProductStock(
        productId,
        s.storeId,
        newQty,
        costChanged ? cost : null,
        delta > 0 && expiry ? expiry : null,
        note.trim() || null
      );
      if (baoTheoKetQua(res, "Đã cập nhật tồn kho và giá vốn")) {
        setExpiry("");
        setNote("");
        setOpen(false);
        router.refresh();
      }
    });
  }

  const summary = (
    <dl className="grid flex-1 grid-cols-3 gap-2 text-sm">
      <div>
        <dt className="text-xs text-muted-foreground">Cửa hàng</dt>
        <dd className="font-semibold">{s.storeCode}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Đang tồn</dt>
        <dd className={s.qty - s.reserved <= 0 ? "font-semibold text-chu-red tabular-nums" : "font-semibold tabular-nums"}>
          {formatNumber(s.qty)}
          {s.reserved > 0 && <span className="ml-1 text-xs font-normal text-muted-foreground">(giữ {formatNumber(s.reserved)})</span>}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Giá vốn</dt>
        <dd className={s.avgCost > 0 ? "font-semibold tabular-nums" : "font-semibold text-chu-amber"}>
          {s.avgCost > 0 ? formatMoney(s.avgCost) : "Chưa có"}
        </dd>
      </div>
    </dl>
  );

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        {summary}
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          Chỉnh
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {summary}
      <fieldset disabled={pending} className="grid gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-qty`}>Tồn kho thực tế</Label>
          <Input
            id={`${id}-qty`}
            type="number"
            inputMode="decimal"
            min={s.reserved}
            step="any"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {delta > 0
              ? `Tăng ${formatNumber(delta)} so với hiện tại.`
              : delta < 0
                ? `Giảm ${formatNumber(-delta)}, trừ lô gần hết hạn trước.`
                : "Nhập số đang có thực tế khi hàng về hoặc khi kiểm lại."}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-cost`}>Giá vốn (₫)</Label>
          <MoneyInput id={`${id}-cost`} value={cost} onChange={setCost} placeholder="Chưa có" />
          <p className="text-xs text-muted-foreground">Áp cho hàng đang tồn và lần bán sau, hóa đơn cũ giữ nguyên.</p>
        </div>
        {delta > 0 && lotExpiry && (
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-expiry`}>Hạn sử dụng phần tăng thêm (không bắt buộc)</Label>
            <Input id={`${id}-expiry`} type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-note`}>Ghi chú</Label>
          <Input
            id={`${id}-note`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ví dụ: hàng về, kiểm lại kho"
          />
        </div>
      </fieldset>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending || !changed} className="h-10 px-5">
          {pending ? "Đang lưu..." : "Lưu"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-10"
          disabled={pending}
          onClick={() => {
            setQty(String(s.qty));
            setCost(s.avgCost > 0 ? s.avgCost : null);
            setExpiry("");
            setNote("");
            setOpen(false);
          }}
        >
          Hủy
        </Button>
      </div>
    </form>
  );
}

export function StockCostPanel({
  productId,
  stores,
  lotExpiry,
}: {
  productId: string;
  stores: StoreStock[];
  lotExpiry: boolean;
}) {
  return (
    <div className="space-y-4 divide-y [&>*:not(:first-child)]:pt-4">
      {stores.map((s) => (
        <StoreForm key={s.storeId} productId={productId} s={s} lotExpiry={lotExpiry} />
      ))}
    </div>
  );
}
