"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PencilIcon, TrashIcon } from "lucide-react";
import { updateOrder, type OrderEditPayload } from "../actions";
import type { CatalogItem } from "../../catalog-actions";
import { baoThanhCong } from "@/lib/feedback";
import { formatMoney, formatNumber } from "@/lib/format";
import { MoneyInput } from "@/components/money-input";
import { ProductPicker } from "@/components/product-picker";
import { LuaChon } from "@/components/lua-chon";
import { GoiY } from "@/components/goi-y";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// available chi co voi dong vua them (tu o tim); dong cu de RPC kiem tra kha dung
type Line = { product_id: string; name: string; unit: string; qty: number; unit_price: number | null; available?: number };

export type EditableOrder = {
  id: string;
  code: string;
  status: string;
  storeId: string;
  sale_id: string | null;
  lines: Line[];
  values: Omit<OrderEditPayload, "items">;
};

export function EditOrder({ storeCode, order }: { storeCode: string; order: EditableOrder }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [h, setH] = useState(order.values);
  const [lines, setLines] = useState(order.lines);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const delivered = order.status === "delivered";
  const isShopee = h.channel === "shopee";
  const dirty = JSON.stringify(h) !== JSON.stringify(order.values) || JSON.stringify(lines) !== JSON.stringify(order.lines);
  const subtotal = lines.reduce((s, l) => s + Math.round(l.qty * (l.unit_price ?? 0)), 0);
  const afterDiscount = subtotal - (h.discount_amount ?? 0);
  const platformFee = isShopee && h.payout_amount != null ? afterDiscount - h.payout_amount : null;

  function onOpenChange(o: boolean) {
    if (o) {
      setH(order.values);
      setLines(order.lines);
      setError(null);
    }
    setOpen(o);
  }

  function setLine(id: string, patch: Partial<Line>) {
    setLines((ls) => ls.map((x) => (x.product_id === id ? { ...x, ...patch } : x)));
  }

  function add(it: CatalogItem) {
    setLines((ls) => {
      const i = ls.findIndex((l) => l.product_id === it.product_id);
      if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, qty: l.qty + it.pack_qty } : l));
      if (it.pack_qty > it.qty_available) {
        toast.error(`${it.name}: chỉ còn ${formatNumber(it.qty_available)}`);
        return ls;
      }
      return [...ls, { product_id: it.product_id, name: it.name, unit: it.unit, qty: it.pack_qty, unit_price: it.sell_price, available: it.qty_available }];
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (lines.length === 0) return setError("Thêm ít nhất một sản phẩm");
    if (lines.some((l) => !(l.qty > 0) || l.unit_price == null)) return setError("Kiểm tra số lượng và giá từng dòng");
    if (platformFee != null && platformFee < 0) return setError("Tiền Shopee trả về lớn hơn tiền hàng sau giảm giá");
    start(async () => {
      const res = await updateOrder(storeCode, order.id, {
        ...h,
        discount_note: (h.discount_amount ?? 0) > 0 ? h.discount_note : null,
        payout_amount: isShopee ? h.payout_amount : null,
        items: lines.map((l) => ({ product_id: l.product_id, qty: l.qty, unit_price: l.unit_price ?? 0 })),
      });
      if (!res.ok) return setError(res.error);
      baoThanhCong(`Đã sửa đơn ${order.code}`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button className="h-10" variant="outline" onClick={() => onOpenChange(true)}>
        <PencilIcon />
        Sửa đơn
      </Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <form onSubmit={submit} className="flex min-h-0 flex-col gap-3">
            <DialogHeader>
              <DialogTitle>Sửa đơn {order.code}</DialogTitle>
            </DialogHeader>
            <DialogBody className="@container space-y-3">
              {error && (
                <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
              <div className="grid gap-x-4 gap-y-3 @md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="e-channel">Kênh</Label>
                  <LuaChon
                    id="e-channel"
                    aria-label="Kênh"
                    value={h.channel}
                    onChange={(v) => setH({ ...h, channel: v as OrderEditPayload["channel"] })}
                    options={[
                      { value: "shopee", label: "Shopee" },
                      { value: "facebook", label: "Facebook" },
                      { value: "other", label: "Khác" },
                    ]}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="e-ext">Mã đơn trên sàn</Label>
                  <Input id="e-ext" value={h.external_order_id ?? ""} onChange={(e) => setH({ ...h, external_order_id: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="e-name">Tên khách</Label>
                  <Input id="e-name" value={h.customer_name ?? ""} onChange={(e) => setH({ ...h, customer_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="e-phone">Số điện thoại</Label>
                  <Input
                    id="e-phone"
                    type="tel"
                    inputMode="tel"
                    value={h.customer_phone ?? ""}
                    onChange={(e) => setH({ ...h, customer_phone: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="e-addr">Địa chỉ giao</Label>
                  <Input id="e-addr" value={h.shipping_address ?? ""} onChange={(e) => setH({ ...h, shipping_address: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="e-ship">Phí ship thu của khách</Label>
                  <MoneyInput id="e-ship" value={h.shipping_fee} onChange={(n) => setH({ ...h, shipping_fee: n ?? 0 })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="e-disc">Giảm giá / voucher</Label>
                  <MoneyInput id="e-disc" value={h.discount_amount} onChange={(n) => setH({ ...h, discount_amount: n ?? 0 })} />
                </div>
                {(h.discount_amount ?? 0) > 0 && (
                  <div className="space-y-1.5">
                    <Label htmlFor="e-dnote">Lý do giảm</Label>
                    <Input id="e-dnote" value={h.discount_note ?? ""} onChange={(e) => setH({ ...h, discount_note: e.target.value })} />
                  </div>
                )}
                {isShopee && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="e-payout">Tiền Shopee trả về</Label>
                      <GoiY label="Tiền Shopee trả về">
                        <p>Số tiền Shopee trả cho đơn này, đã trừ phí sàn. Phí sàn = tiền hàng sau giảm giá - tiền Shopee trả về.</p>
                      </GoiY>
                    </div>
                    <MoneyInput id="e-payout" value={h.payout_amount} onChange={(n) => setH({ ...h, payout_amount: n })} />
                    {platformFee != null && (
                      <p className={`text-sm font-semibold tabular-nums ${platformFee < 0 ? "text-chu-red" : "text-chu-amber"}`}>
                        Phí sàn {formatMoney(platformFee)}
                        {afterDiscount > 0 && ` (${((platformFee / afterDiscount) * 100).toFixed(1).replace(".", ",")}%)`}
                      </p>
                    )}
                  </div>
                )}
                <div className="space-y-1.5 @md:col-span-2">
                  <Label htmlFor="e-pm">Thanh toán</Label>
                  <LuaChon
                    id="e-pm"
                    aria-label="Thanh toán"
                    value={h.payment_method}
                    onChange={(v) => setH({ ...h, payment_method: v as OrderEditPayload["payment_method"] })}
                    options={[
                      { value: "transfer", label: "CK / sàn trả" },
                      { value: "cash", label: "Tiền mặt COD" },
                      { value: "other", label: "Khác" },
                    ]}
                  />
                </div>
                <div className="space-y-1.5 @md:col-span-2">
                  <Label htmlFor="e-note">Ghi chú</Label>
                  <Textarea id="e-note" rows={2} value={h.note ?? ""} onChange={(e) => setH({ ...h, note: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2 border-t pt-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium">Sản phẩm ({lines.length})</span>
                    {delivered && (
                      <GoiY label="Sửa sản phẩm đơn đã giao">
                        <p>Đổi sản phẩm hoặc số lượng: hàng cũ trả về đúng lô đã xuất, hàng mới xuất theo lô hạn gần nhất, giá vốn tính theo giá vốn hiện tại.</p>
                        <p>Giao dịch bán giữ mã và ngày giao, cập nhật tiền hàng, giá vốn và thanh toán.</p>
                      </GoiY>
                    )}
                  </div>
                  <span className="text-sm tabular-nums">Tiền hàng {formatMoney(subtotal)}</span>
                </div>
                <ProductPicker storeId={order.storeId} onPick={add} />
                <ul className="divide-y">
                  {lines.map((l) => (
                    <li key={l.product_id} className="grid grid-cols-2 items-end gap-2 py-2 @md:grid-cols-[1fr_90px_140px_auto]">
                      <div className="col-span-2 text-sm @md:col-span-1">
                        {l.name}
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {l.available != null ? `Còn ${formatNumber(l.available)} ${l.unit}` : l.unit}
                          {" - "}
                          {formatMoney(Math.round(l.qty * (l.unit_price ?? 0)))}
                        </div>
                      </div>
                      <label className="text-xs text-muted-foreground">
                        SL
                        <Input type="number" min={1} value={l.qty} onChange={(e) => setLine(l.product_id, { qty: Number(e.target.value) })} />
                      </label>
                      <label className="text-xs text-muted-foreground">
                        Giá bán
                        <MoneyInput value={l.unit_price} onChange={(n) => setLine(l.product_id, { unit_price: n })} />
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Xóa ${l.name}`}
                        onClick={() => setLines((ls) => ls.filter((x) => x.product_id !== l.product_id))}
                      >
                        <TrashIcon />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
              {order.sale_id && <p className="text-xs text-muted-foreground">Đơn đã giao: tồn kho, giao dịch bán, giá vốn và thanh toán cập nhật theo đơn mới.</p>}
            </DialogBody>
            <DialogFooter className="items-center">
              {dirty && <span className="text-xs text-chu-amber sm:mr-auto">Có thay đổi chưa lưu</span>}
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={pending || !dirty}>
                {pending ? "Đang lưu..." : "Lưu"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
