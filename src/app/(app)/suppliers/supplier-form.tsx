"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveSupplier } from "./actions";
import type { SupplierInput } from "@/lib/schemas/supplier";
import { LuaChon } from "@/components/lua-chon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type TextKey = "contact_name" | "phone" | "email" | "tax_code" | "bank_name" | "bank_account";

const TEXT_FIELDS: { key: TextKey; label: string; type?: string; inputMode?: "tel" | "email" }[] = [
  { key: "contact_name", label: "Người liên hệ" },
  { key: "phone", label: "Điện thoại", type: "tel", inputMode: "tel" },
  { key: "email", label: "Email", type: "email", inputMode: "email" },
  { key: "tax_code", label: "Mã số thuế" },
  { key: "bank_name", label: "Ngân hàng" },
  { key: "bank_account", label: "Số tài khoản" },
];

export function SupplierForm({ id, initial, readOnly }: { id: string | null; initial: SupplierInput; readOnly: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof SupplierInput>(k: K, val: SupplierInput[K]) => setV((s) => ({ ...s, [k]: val }));
  // Sau khi luu, router.refresh() dua gia tri moi vao initial nen het "chua luu".
  // O trong coi nhu null vi server luu chuoi rong thanh null.
  const norm = (x: SupplierInput) => JSON.stringify(x, (_k, val) => (typeof val === "string" && val.trim() === "" ? null : val));
  const dirty = norm(v) !== norm(initial);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await saveSupplier(id, v);
      if (!res.ok) return void setError(res.error);
      toast.success(id ? "Đã lưu nhà cung cấp" : "Đã tạo nhà cung cấp");
      if (!id && res.data) router.push(`/suppliers/${res.data.id}`);
      else router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="@container space-y-4">
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <fieldset disabled={readOnly || pending} className="grid gap-x-4 gap-y-3 @md:grid-cols-2 @3xl:grid-cols-4">
        <div className="space-y-1.5 @md:col-span-2">
          <Label htmlFor="name">Tên nhà cung cấp *</Label>
          <Input id="name" value={v.name} onChange={(e) => set("name", e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="terms">Số ngày được nợ *</Label>
          <Input
            id="terms"
            type="number"
            min={0}
            max={365}
            title="Dùng để tính ngày đến hạn công nợ"
            value={v.payment_terms_days}
            onChange={(e) => set("payment_terms_days", Math.max(0, Number(e.target.value) || 0))}
          />
          <p className="text-xs text-muted-foreground">0 = trả ngay</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="is_active">Trạng thái</Label>
          <LuaChon
            id="is_active"
            aria-label="Trạng thái"
            value={v.is_active ? "1" : "0"}
            onChange={(x) => set("is_active", x === "1")}
            options={[
              { value: "1", label: "Đang giao dịch" },
              { value: "0", label: "Ngừng" },
            ]}
          />
        </div>
        {TEXT_FIELDS.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label htmlFor={f.key}>{f.label}</Label>
            <Input
              id={f.key}
              type={f.type ?? "text"}
              inputMode={f.inputMode}
              value={v[f.key] ?? ""}
              onChange={(e) => set(f.key, e.target.value)}
            />
          </div>
        ))}
        <div className="space-y-1.5 @md:col-span-2">
          <Label htmlFor="address">Địa chỉ</Label>
          <Input id="address" value={v.address ?? ""} onChange={(e) => set("address", e.target.value)} />
        </div>
        <div className="space-y-1.5 @md:col-span-2 @3xl:col-span-4">
          <Label htmlFor="note">Ghi chú</Label>
          <Textarea id="note" rows={1} className="min-h-9" value={v.note ?? ""} onChange={(e) => set("note", e.target.value || null)} />
        </div>
      </fieldset>
      {!readOnly && (
        <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 -mx-4 -mb-4 flex flex-wrap items-center gap-3 rounded-b-xl border-t bg-card/95 px-4 py-3 backdrop-blur lg:bottom-0">
          <Button type="submit" disabled={pending || (!!id && !dirty)} className="h-10 px-5">
            {pending ? "Đang lưu..." : id ? "Lưu thay đổi" : "Tạo nhà cung cấp"}
          </Button>
          {id && (
            <span aria-live="polite" className={dirty ? "text-sm font-medium text-chu-amber" : "text-sm text-muted-foreground"}>
              {dirty ? "Có thay đổi chưa lưu" : "Đã lưu"}
            </span>
          )}
        </div>
      )}
    </form>
  );
}
