"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TrashIcon } from "lucide-react";
import { createOrder, type OrderPayload } from "../actions";
import type { CatalogItem } from "../../catalog-actions";
import { formatMoney, formatNumber } from "@/lib/format";
import { ProductPicker } from "@/components/product-picker";
import { MoneyInput } from "@/components/money-input";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Line = { product_id: string; name: string; unit: string; available: number; qty: number; unit_price: number | null };

export function OrderForm({ storeId, storeCode }: { storeId: string; storeCode: string }) {
  const router = useRouter();
  const [h, setH] = useState({
    channel: "shopee" as OrderPayload["channel"],
    external_order_id: "",
    customer_name: "",
    customer_phone: "",
    shipping_address: "",
    shipping_fee: null as number | null,
    discount_amount: null as number | null,
    payment_method: "transfer" as OrderPayload["payment_method"],
    note: "",
  });
  const [lines, setLines] = useState<Line[]>([]);
  const [pending, start] = useTransition();
  const subtotal = lines.reduce((s, l) => s + Math.round(l.qty * (l.unit_price ?? 0)), 0);
  const total = subtotal + (h.shipping_fee ?? 0) - (h.discount_amount ?? 0);

  function add(it: CatalogItem) {
    setLines((ls) => {
      const i = ls.findIndex((l) => l.product_id === it.product_id);
      const qty = (i >= 0 ? ls[i].qty : 0) + it.pack_qty;
      if (qty > it.qty_available) {
        toast.error(`${it.name}: chỉ còn ${formatNumber(it.qty_available)}`);
        return ls;
      }
      if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, qty } : l));
      return [...ls, { product_id: it.product_id, name: it.name, unit: it.unit, available: it.qty_available, qty, unit_price: it.sell_price }];
    });
  }

  function submit() {
    if (lines.some((l) => !(l.qty > 0) || l.unit_price == null)) return void toast.error("Kiểm tra số lượng và giá từng dòng");
    start(async () => {
      const res = await createOrder(storeCode, {
        store_id: storeId,
        channel: h.channel,
        external_order_id: h.external_order_id || null,
        customer_name: h.customer_name || null,
        customer_phone: h.customer_phone || null,
        shipping_address: h.shipping_address || null,
        shipping_fee: h.shipping_fee ?? 0,
        discount_amount: h.discount_amount ?? 0,
        payment_method: h.payment_method,
        note: h.note || null,
        items: lines.map((l) => ({ product_id: l.product_id, qty: l.qty, unit_price: l.unit_price ?? 0 })),
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Đã tạo đơn ${res.data!.code}`);
      router.push(`/${storeCode}/orders/${res.data!.id}`);
    });
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="channel">Kênh *</Label>
          <NativeSelect id="channel" value={h.channel} onChange={(e) => setH({ ...h, channel: e.target.value as OrderPayload["channel"] })}>
            <option value="shopee">Shopee</option>
            <option value="facebook">Facebook</option>
            <option value="other">Khác</option>
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ext">Mã đơn trên sàn</Label>
          <Input id="ext" value={h.external_order_id} onChange={(e) => setH({ ...h, external_order_id: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cname">Tên khách</Label>
          <Input id="cname" value={h.customer_name} onChange={(e) => setH({ ...h, customer_name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cphone">Số điện thoại</Label>
          <Input id="cphone" type="tel" inputMode="tel" value={h.customer_phone} onChange={(e) => setH({ ...h, customer_phone: e.target.value })} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="addr">Địa chỉ giao</Label>
          <Input id="addr" value={h.shipping_address} onChange={(e) => setH({ ...h, shipping_address: e.target.value })} />
        </div>
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="font-medium">Sản phẩm</h2>
        <ProductPicker storeId={storeId} onPick={add} />
        {lines.map((l) => (
          <div key={l.product_id} className="grid grid-cols-2 items-end gap-2 border-t pt-2 sm:grid-cols-[1fr_100px_150px_120px_auto]">
            <div className="col-span-2 text-sm sm:col-span-1">
              {l.name}
              <div className="text-xs text-muted-foreground">Còn {formatNumber(l.available)} {l.unit}</div>
            </div>
            <label className="text-xs text-muted-foreground">
              SL
              <Input
                type="number"
                min={1}
                max={l.available}
                value={l.qty}
                onChange={(e) =>
                  setLines((ls) => ls.map((x) => (x.product_id === l.product_id ? { ...x, qty: Math.min(Number(e.target.value), x.available) } : x)))
                }
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Giá bán trên sàn
              <MoneyInput
                value={l.unit_price}
                onChange={(n) => setLines((ls) => ls.map((x) => (x.product_id === l.product_id ? { ...x, unit_price: n } : x)))}
              />
            </label>
            <div className="text-right text-sm font-medium tabular-nums">{formatMoney(Math.round(l.qty * (l.unit_price ?? 0)))}</div>
            <Button variant="ghost" size="icon" aria-label={`Xóa ${l.name}`} onClick={() => setLines((ls) => ls.filter((x) => x.product_id !== l.product_id))}>
              <TrashIcon />
            </Button>
          </div>
        ))}
      </section>

      <section className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="ship">Phí ship thu của khách</Label>
          <MoneyInput id="ship" value={h.shipping_fee} onChange={(n) => setH({ ...h, shipping_fee: n })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="disc">Giảm giá / voucher</Label>
          <MoneyInput id="disc" value={h.discount_amount} onChange={(n) => setH({ ...h, discount_amount: n })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pm">Thanh toán</Label>
          <NativeSelect id="pm" value={h.payment_method} onChange={(e) => setH({ ...h, payment_method: e.target.value as OrderPayload["payment_method"] })}>
            <option value="transfer">Chuyển khoản / sàn trả</option>
            <option value="cash">Tiền mặt (COD)</option>
            <option value="other">Khác</option>
          </NativeSelect>
        </div>
        <div className="space-y-1.5 sm:col-span-3">
          <Label htmlFor="onote">Ghi chú</Label>
          <Textarea id="onote" rows={2} value={h.note} onChange={(e) => setH({ ...h, note: e.target.value })} />
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
        <div className="text-sm">
          Tiền hàng {formatMoney(subtotal)} + ship {formatMoney(h.shipping_fee ?? 0)} - giảm {formatMoney(h.discount_amount ?? 0)}
          <div className="text-lg font-semibold">Tổng đơn {formatMoney(total)}</div>
        </div>
        <Button className="h-11 px-6" disabled={pending || lines.length === 0} onClick={submit}>
          {pending ? "Đang tạo..." : "Tạo đơn và giữ hàng"}
        </Button>
      </div>
    </div>
  );
}
