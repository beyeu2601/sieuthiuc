"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateStore, type StoreInput } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function StoreForm({ storeId, initial }: { storeId: string; initial: StoreInput }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const set = (k: keyof StoreInput, val: string) => setV((s) => ({ ...s, [k]: val === "" ? null : val }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await updateStore(storeId, v);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Đã lưu thông tin cửa hàng");
      router.refresh();
    });
  }

  const id = (k: string) => `${storeId}-${k}`;
  return (
    <form onSubmit={submit}>
      <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={id("name")}>Tên cửa hàng *</Label>
          <Input id={id("name")} value={v.name ?? ""} onChange={(e) => set("name", e.target.value)} required />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={id("address")}>Địa chỉ</Label>
          <Input id={id("address")} value={v.address ?? ""} onChange={(e) => set("address", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("phone")}>Điện thoại</Label>
          <Input id={id("phone")} type="tel" value={v.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("tax")}>Mã số thuế</Label>
          <Input id={id("tax")} value={v.tax_code ?? ""} onChange={(e) => set("tax_code", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("header")}>Dòng đầu hóa đơn</Label>
          <Textarea id={id("header")} rows={2} value={v.invoice_header ?? ""} onChange={(e) => set("invoice_header", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("footer")}>Dòng cuối hóa đơn</Label>
          <Textarea
            id={id("footer")}
            rows={2}
            value={v.invoice_footer ?? ""}
            placeholder="Ví dụ: Cảm ơn quý khách"
            onChange={(e) => set("invoice_footer", e.target.value)}
          />
        </div>
      </fieldset>
      <Button type="submit" className="mt-4 h-10" disabled={pending}>
        {pending ? "Đang lưu..." : "Lưu"}
      </Button>
    </form>
  );
}
