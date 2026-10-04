"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PencilIcon } from "lucide-react";
import { updateOrder, type OrderEditPayload } from "../actions";
import { baoThanhCong } from "@/lib/feedback";
import { formatMoney } from "@/lib/format";
import { MoneyInput } from "@/components/money-input";
import { LuaChon } from "@/components/lua-chon";
import { GoiY } from "@/components/goi-y";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type EditableOrder = {
  id: string;
  code: string;
  channel: string;
  subtotal: number;
  sale_id: string | null;
  values: OrderEditPayload;
};

export function EditOrder({ storeCode, order }: { storeCode: string; order: EditableOrder }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [h, setH] = useState(order.values);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const isShopee = order.channel === "shopee";
  const dirty = JSON.stringify(h) !== JSON.stringify(order.values);
  const afterDiscount = order.subtotal - (h.discount_amount ?? 0);
  const platformFee = isShopee && h.payout_amount != null ? afterDiscount - h.payout_amount : null;

  function onOpenChange(o: boolean) {
    if (o) {
      setH(order.values);
      setError(null);
    }
    setOpen(o);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (platformFee != null && platformFee < 0) return setError("Tiền Shopee trả về lớn hơn tiền hàng sau giảm giá");
    start(async () => {
      const res = await updateOrder(storeCode, order.id, {
        ...h,
        discount_note: (h.discount_amount ?? 0) > 0 ? h.discount_note : null,
        payout_amount: isShopee ? h.payout_amount : null,
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
              {order.sale_id && <p className="text-xs text-muted-foreground">Đơn đã giao: giao dịch bán cập nhật theo giảm giá và thanh toán mới.</p>}
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
