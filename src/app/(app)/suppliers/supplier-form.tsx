"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveSupplier } from "./actions";
import type { SupplierInput } from "@/lib/schemas/supplier";
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
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <fieldset disabled={readOnly || pending} className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="name">Tên nhà cung cấp *</Label>
          <Input id="name" value={v.name} onChange={(e) => set("name", e.target.value)} required />
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
        <div className="space-y-1.5">
          <Label htmlFor="terms">Số ngày được nợ *</Label>
          <Input
            id="terms"
            type="number"
            min={0}
            max={365}
            value={v.payment_terms_days}
            onChange={(e) => set("payment_terms_days", Math.max(0, Number(e.target.value) || 0))}
          />
          <p className="text-xs text-muted-foreground">0 = trả ngay. Dùng để tính ngày đến hạn công nợ.</p>
        </div>
        <div className="flex items-center gap-2 pt-6">
          <input
            id="is_active"
            type="checkbox"
            className="size-4"
            checked={v.is_active}
            onChange={(e) => set("is_active", e.target.checked)}
          />
          <Label htmlFor="is_active">Đang giao dịch</Label>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="address">Địa chỉ</Label>
          <Input id="address" value={v.address ?? ""} onChange={(e) => set("address", e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="note">Ghi chú</Label>
          <Textarea id="note" rows={2} value={v.note ?? ""} onChange={(e) => set("note", e.target.value || null)} />
        </div>
      </fieldset>
      {!readOnly && (
        <div className="flex gap-2">
          <Button type="submit" disabled={pending} className="h-10 px-5">
            {pending ? "Đang lưu..." : id ? "Lưu thay đổi" : "Tạo nhà cung cấp"}
          </Button>
          <Button type="button" variant="ghost" className="h-10" onClick={() => router.back()}>
            Quay lại
          </Button>
        </div>
      )}
    </form>
  );
}
