"use client";

import { useState, useTransition } from "react";
import { productLots, type CatalogItem, type LotRow } from "../catalog-actions";
import { formatMoney, formatNumber } from "@/lib/format";
import { GOODS_TYPE_LABEL } from "@/lib/text";
import { ProductPicker } from "@/components/product-picker";
import { Badge } from "@/components/ui/badge";

const EXPIRY_BADGE = {
  none: { label: "Không hạn", cls: "bg-muted text-foreground" },
  normal: { label: "Còn hạn", cls: "bg-success-soft text-success" },
  near: { label: "Gần hết hạn", cls: "bg-warning-soft text-warning" },
  expired: { label: "Hết hạn", cls: "bg-danger-soft text-destructive" },
} as const;

export function LookupClient({ storeId }: { storeId: string }) {
  const [item, setItem] = useState<CatalogItem | null>(null);
  const [lots, setLots] = useState<LotRow[]>([]);
  const [pending, start] = useTransition();

  function pick(it: CatalogItem) {
    setItem(it);
    start(async () => {
      const res = await productLots(storeId, it.product_id);
      setLots(res.ok ? (res.data ?? []) : []);
    });
  }

  return (
    <div className="space-y-4">
      <ProductPicker storeId={storeId} onPick={pick} autoFocus />
      {item && (
        <article className="space-y-3 rounded-xl border bg-card p-4" aria-live="polite">
          <div>
            <h2 className="text-lg font-semibold">{item.name}</h2>
            <p className="text-sm text-muted-foreground">
              {item.sku} - {GOODS_TYPE_LABEL[item.goods_type]} - {item.unit}
              {item.barcode ? ` - ${item.barcode}` : ""}
            </p>
            {item.status === "inactive" && <Badge variant="outline">Ngừng bán</Badge>}
          </div>
          <p className="text-3xl font-bold tabular-nums">{formatMoney(item.sell_price)}</p>
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-muted p-2">
              <dt className="text-xs text-muted-foreground">Tồn thực tế</dt>
              <dd className="text-lg font-semibold tabular-nums">{formatNumber(item.qty_on_hand)}</dd>
            </div>
            <div className="rounded-lg bg-muted p-2">
              <dt className="text-xs text-muted-foreground">Đang giữ</dt>
              <dd className="text-lg font-semibold tabular-nums">{formatNumber(item.qty_reserved)}</dd>
            </div>
            <div className="rounded-lg bg-muted p-2">
              <dt className="text-xs text-muted-foreground">Khả dụng</dt>
              <dd className="text-lg font-semibold tabular-nums">{formatNumber(item.qty_available)}</dd>
            </div>
          </dl>
          <div>
            <h3 className="mb-2 text-sm font-medium">Lô còn hàng</h3>
            {pending ? (
              <p className="text-sm text-muted-foreground">Đang tải...</p>
            ) : lots.length === 0 ? (
              <p className="text-sm text-muted-foreground">Không có lô nào còn hàng.</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {lots.map((l) => {
                  const b = EXPIRY_BADGE[l.expiry_status];
                  return (
                    <li key={l.lot_id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span>
                        {l.lot_no}
                        <span className="block text-xs text-muted-foreground">
                          HSD {l.expiry_date ? new Date(l.expiry_date).toLocaleDateString("vi-VN") : "không có"}
                          {l.days_left != null ? ` (${l.days_left < 0 ? `quá ${-l.days_left}` : `còn ${l.days_left}`} ngày)` : ""}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="tabular-nums">{formatNumber(l.qty_on_hand)}</span>
                        <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${b.cls}`}>{b.label}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </article>
      )}
    </div>
  );
}
