"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { productLots, type CatalogItem, type LotRow } from "../catalog-actions";
import { formatMoney, formatNumber } from "@/lib/format";
import { GOODS_TYPE_LABEL } from "@/lib/text";
import { ProductPicker } from "@/components/product-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { addBarcode } from "@/app/(app)/products/actions";
import { baoTheoKetQua } from "@/lib/feedback";

const EXPIRY_BADGE = {
  none: { label: "Không hạn", cls: "bg-muted text-foreground" },
  normal: { label: "Còn hạn", cls: "bg-success-soft text-success" },
  near: { label: "Gần hết hạn", cls: "bg-warning-soft text-warning" },
  expired: { label: "Hết hạn", cls: "bg-danger-soft text-destructive" },
} as const;

// Ma vach hang that (EAN-8/13, UPC, ITF-14): chi so, 8-14 ky tu. Go ten thi khong de nghi gan.
const BARCODE_RE = /^\d{8,14}$/;

export function LookupClient({ storeId, canAssign }: { storeId: string; canAssign: boolean }) {
  const [item, setItem] = useState<CatalogItem | null>(null);
  const [lots, setLots] = useState<LotRow[]>([]);
  const [pending, start] = useTransition();
  // Quet ma chua co trong he thong -> gan ma do cho mot san pham (2 buoc: chon san pham, xac nhan)
  const [unknownCode, setUnknownCode] = useState<string | null>(null);
  const [target, setTarget] = useState<CatalogItem | null>(null);
  const [assigning, startAssign] = useTransition();
  const router = useRouter();

  function pick(it: CatalogItem) {
    setUnknownCode(null);
    setTarget(null);
    setItem(it);
    start(async () => {
      const res = await productLots(storeId, it.product_id);
      setLots(res.ok ? (res.data ?? []) : []);
    });
  }

  function notFound(term: string) {
    if (!canAssign || !BARCODE_RE.test(term)) return false;
    setItem(null);
    setTarget(null);
    setUnknownCode(term);
    return true;
  }

  function assign() {
    if (!unknownCode || !target) return;
    const code = unknownCode;
    const it = target;
    startAssign(async () => {
      const res = await addBarcode(it.product_id, code, 1, !it.barcode);
      if (baoTheoKetQua(res, `Đã gán mã ${code} cho ${it.name}`)) {
        pick({ ...it, barcode: it.barcode ?? code });
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <ProductPicker storeId={storeId} onPick={pick} onNotFound={notFound} autoFocus camera />
      {unknownCode && (
        <section className="space-y-3 rounded-xl border border-warning bg-warning-soft/40 p-4" aria-live="polite">
          <p className="text-sm">
            Mã <span className="font-semibold tabular-nums">{unknownCode}</span> chưa gắn với sản phẩm nào. Chọn sản phẩm để gán mã này.
          </p>
          {target ? (
            <div className="space-y-3">
              <p className="rounded-lg border bg-card p-3 text-sm">
                <span className="font-medium">{target.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {target.sku} - {GOODS_TYPE_LABEL[target.goods_type]} - {target.unit}
                  {target.barcode ? ` - đang có mã ${target.barcode}` : " - chưa có mã vạch"}
                </span>
              </p>
              <div className="flex gap-2">
                <Button className="h-11 flex-1" onClick={assign} disabled={assigning}>
                  {assigning ? "Đang gán..." : "Gán mã cho sản phẩm này"}
                </Button>
                <Button variant="outline" className="h-11" onClick={() => setTarget(null)} disabled={assigning}>
                  Chọn lại
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <div className="flex-1">
                <ProductPicker storeId={storeId} onPick={setTarget} placeholder="Gõ tên sản phẩm cần gán mã" autoFocus />
              </div>
              <Button variant="outline" className="h-11" onClick={() => setUnknownCode(null)}>
                Bỏ qua
              </Button>
            </div>
          )}
        </section>
      )}
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
