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
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm">
        Cửa hàng <strong>{s.storeCode}</strong>: đang tồn <strong className="tabular-nums">{formatNumber(s.qty)}</strong>
        {s.reserved > 0 && <> (giữ cho đơn online {formatNumber(s.reserved)})</>}, giá vốn{" "}
        <strong className="tabular-nums">{s.avgCost > 0 ? formatMoney(s.avgCost) : "chưa có"}</strong>
      </p>
      <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">
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
          <p className="text-xs text-muted-foreground">Áp cho hàng đang tồn và các lần bán sau. Hóa đơn đã bán giữ nguyên.</p>
        </div>
        {delta > 0 && lotExpiry && (
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-expiry`}>Hạn sử dụng của phần tăng thêm</Label>
            <Input id={`${id}-expiry`} type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
            <p className="text-xs text-muted-foreground">Không bắt buộc.</p>
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
      <Button type="submit" disabled={pending || !changed} className="h-10 px-5">
        {pending ? "Đang lưu..." : "Lưu tồn kho và giá vốn"}
      </Button>
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
    <div className="space-y-6">
      {stores.map((s) => (
        <StoreForm key={s.storeId} productId={productId} s={s} lotExpiry={lotExpiry} />
      ))}
    </div>
  );
}
