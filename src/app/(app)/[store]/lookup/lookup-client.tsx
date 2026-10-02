"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { productLots, type CatalogItem, type LotRow } from "../catalog-actions";
import { formatMoney, formatNumber } from "@/lib/format";
import { GOODS_TYPE_LABEL } from "@/lib/text";
import { ProductPicker } from "@/components/product-picker";
import { ChipHan, ChipSac, NEN_SAC, VIEN_SAC, sacLoaiHang } from "@/components/ui/chip";
import { ChiSo } from "@/components/ui/chi-so";
import { Button } from "@/components/ui/button";
import { addBarcode } from "@/app/(app)/products/actions";
import { baoTheoKetQua } from "@/lib/feedback";
import { cn } from "@/lib/utils";

function ChipHanLo({ status }: { status: LotRow["expiry_status"] }) {
  if (status === "none") return <ChipSac sac="slate">Không hạn</ChipSac>;
  if (status === "expired") return <ChipHan ma="hetHan">Hết hạn</ChipHan>;
  if (status === "near") return <ChipHan ma="canDate">Gần hết hạn</ChipHan>;
  return <ChipHan ma="conHan">Còn hạn</ChipHan>;
}

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
        <section className={cn("space-y-3 rounded-xl border p-4", NEN_SAC.amber, VIEN_SAC.amber)} aria-live="polite">
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
            <h2 className="text-lg leading-snug font-semibold">{item.name}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <ChipSac sac="slate" className="font-mono">{item.sku}</ChipSac>
              <ChipSac sac={sacLoaiHang(item.goods_type)}>{GOODS_TYPE_LABEL[item.goods_type]}</ChipSac>
              <ChipSac sac="slate">{item.unit}</ChipSac>
              {item.barcode ? (
                <ChipSac sac="slate" className="tabular-nums">{item.barcode}</ChipSac>
              ) : (
                <ChipSac sac="amber">Chưa có mã vạch</ChipSac>
              )}
              {item.status === "inactive" && <ChipSac sac="red">Ngừng bán</ChipSac>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ChiSo nhan="Giá bán" sac="brand" giaTri={<span className="text-2xl font-bold lg:text-3xl">{formatMoney(item.sell_price)}</span>} />
            <ChiSo
              nhan={item.qty_available <= 0 ? "Khả dụng: hết hàng" : "Khả dụng"}
              sac={item.qty_available <= 0 ? "red" : "emerald"}
              giaTri={<span className="text-2xl font-bold lg:text-3xl">{formatNumber(item.qty_available)}</span>}
              phu={`Tồn ${formatNumber(item.qty_on_hand)} - giữ cho đơn ${formatNumber(item.qty_reserved)}`}
            />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium">Lô còn hàng{!pending && lots.length > 0 ? ` (${lots.length})` : ""}</h3>
            {pending ? (
              <p className="text-sm text-muted-foreground">Đang tải...</p>
            ) : lots.length === 0 ? (
              <p className="text-sm text-muted-foreground">Không có lô nào còn hàng.</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {lots.map((l) => (
                  <li key={l.lot_id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span className="min-w-0">
                      {l.lot_no}
                      <span className="block text-xs text-muted-foreground">
                        HSD {l.expiry_date ? new Date(l.expiry_date).toLocaleDateString("vi-VN") : "không có"}
                        {l.days_left != null ? ` (${l.days_left < 0 ? `quá ${-l.days_left}` : `còn ${l.days_left}`} ngày)` : ""}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="font-medium tabular-nums">{formatNumber(l.qty_on_hand)}</span>
                      <ChipHanLo status={l.expiry_status} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>
      )}
    </div>
  );
}
