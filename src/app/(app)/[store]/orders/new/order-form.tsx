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
import { LuaChon } from "@/components/lua-chon";
import { Khoi } from "@/components/khoi";
import { GoiY } from "@/components/goi-y";
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
    discount_note: "",
    payout_amount: null as number | null,
    deliver: "pending" as "pending" | "delivered",
    payment_method: "transfer" as OrderPayload["payment_method"],
    note: "",
  });
  const [lines, setLines] = useState<Line[]>([]);
  const [pending, start] = useTransition();
  const subtotal = lines.reduce((s, l) => s + Math.round(l.qty * (l.unit_price ?? 0)), 0);
  const total = subtotal + (h.shipping_fee ?? 0) - (h.discount_amount ?? 0);
  const isShopee = h.channel === "shopee";
  // Phi san = tien hang sau giam gia - tien Shopee tra ve (cung co so voi doi soat)
  const afterDiscount = subtotal - (h.discount_amount ?? 0);
  const platformFee = isShopee && h.payout_amount != null ? afterDiscount - h.payout_amount : null;

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
    if (platformFee != null && platformFee < 0) return void toast.error("Tiền Shopee trả về lớn hơn tiền hàng sau giảm giá");
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
        discount_note: (h.discount_amount ?? 0) > 0 ? h.discount_note.trim() || null : null,
        payout_amount: isShopee ? h.payout_amount : null,
        deliver_now: h.deliver === "delivered",
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
    <div className="@container space-y-4">
      <section className="grid gap-x-4 gap-y-3 rounded-xl border bg-card p-4 @md:grid-cols-2 @3xl:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="channel">Kênh *</Label>
          <LuaChon
            id="channel"
            aria-label="Kênh"
            value={h.channel}
            onChange={(v) => setH({ ...h, channel: v as OrderPayload["channel"] })}
            options={[
              { value: "shopee", label: "Shopee" },
              { value: "facebook", label: "Facebook" },
              { value: "other", label: "Khác" },
            ]}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="deliver">Trạng thái *</Label>
          <LuaChon
            id="deliver"
            aria-label="Trạng thái"
            value={h.deliver}
            onChange={(v) => setH({ ...h, deliver: v as "pending" | "delivered" })}
            options={[
              { value: "pending", label: "Chờ giao" },
              { value: "delivered", label: "Đã giao" },
            ]}
          />
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
        <div className="space-y-1.5 @md:col-span-2 @3xl:col-span-3">
          <Label htmlFor="addr">Địa chỉ giao</Label>
          <Input id="addr" value={h.shipping_address} onChange={(e) => setH({ ...h, shipping_address: e.target.value })} />
        </div>
      </section>

      <Khoi title="Sản phẩm" className="space-y-3" aside={<span className="text-xs text-muted-foreground tabular-nums">{lines.length}</span>}>
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
      </Khoi>

      <section className="grid gap-x-4 gap-y-3 rounded-xl border bg-card p-4 @md:grid-cols-2 @3xl:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="ship">Phí ship thu của khách</Label>
          <MoneyInput id="ship" value={h.shipping_fee} onChange={(n) => setH({ ...h, shipping_fee: n })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="disc">Giảm giá / voucher</Label>
          <MoneyInput id="disc" value={h.discount_amount} onChange={(n) => setH({ ...h, discount_amount: n })} />
        </div>
        {(h.discount_amount ?? 0) > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="dnote">Lý do giảm</Label>
            <Input id="dnote" value={h.discount_note} onChange={(e) => setH({ ...h, discount_note: e.target.value })} />
          </div>
        )}
        {isShopee && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label htmlFor="payout">Tiền Shopee trả về</Label>
              <GoiY label="Tiền Shopee trả về">
                <p>Số tiền Shopee trả cho đơn này, đã trừ phí sàn.</p>
                <p>Chênh lệch với tiền hàng sau giảm giá là phí sàn, ghi vào chi phí khi đối soát tiền về. Bỏ trống nếu chưa biết.</p>
              </GoiY>
            </div>
            <MoneyInput id="payout" value={h.payout_amount} onChange={(n) => setH({ ...h, payout_amount: n })} />
            {platformFee != null && platformFee >= 0 && afterDiscount > 0 && (
              <p className="text-xs text-muted-foreground tabular-nums">
                Phí sàn {formatMoney(platformFee)} ({((platformFee / afterDiscount) * 100).toFixed(1).replace(".", ",")}%)
              </p>
            )}
          </div>
        )}
        <div className="space-y-1.5 @md:col-span-2">
          <Label htmlFor="pm">Thanh toán</Label>
          <LuaChon
            id="pm"
            aria-label="Thanh toán"
            value={h.payment_method}
            onChange={(v) => setH({ ...h, payment_method: v as OrderPayload["payment_method"] })}
            options={[
              { value: "transfer", label: "CK / sàn trả" },
              { value: "cash", label: "Tiền mặt COD" },
              { value: "other", label: "Khác" },
            ]}
          />
        </div>
        <div className="space-y-1.5 @md:col-span-2 @3xl:col-span-4">
          <Label htmlFor="onote">Ghi chú</Label>
          <Textarea id="onote" rows={2} value={h.note} onChange={(e) => setH({ ...h, note: e.target.value })} />
        </div>
      </section>

      {/* Tong va nut tao luon thay khi danh sach dai; dien thoai tru chieu cao thanh tab duoi day */}
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm lg:bottom-0">
        <div className="text-sm">
          Tiền hàng {formatMoney(subtotal)} + ship {formatMoney(h.shipping_fee ?? 0)} - giảm {formatMoney(h.discount_amount ?? 0)}
          <div className="text-lg font-semibold">Tổng đơn {formatMoney(total)}</div>
          {platformFee != null && <div className="text-muted-foreground">Shopee trả về {formatMoney(h.payout_amount ?? 0)}</div>}
        </div>
        <Button
          className="h-11 px-6"
          disabled={pending || lines.length === 0}
          onClick={submit}
          title={
            h.deliver === "delivered"
              ? "Ghi doanh thu và trừ kho ngay"
              : "Hàng trong đơn được giữ lại cho tới khi giao xong hoặc hủy đơn"
          }
        >
          {pending ? "Đang tạo..." : h.deliver === "delivered" ? "Tạo đơn đã giao" : "Tạo đơn và giữ hàng"}
        </Button>
      </div>
    </div>
  );
}
