"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveSettings } from "./actions";
import type { SettingDef } from "@/lib/setting-defs";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SettingsForm({
  defs,
  values,
  storeId,
}: {
  defs: SettingDef[];
  values: Record<string, unknown>;
  storeId: string | null;
}) {
  const router = useRouter();
  const [v, setV] = useState<Record<string, unknown>>(values);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    for (const d of defs) {
      const val = v[d.key];
      if (d.kind === "text") {
        if (typeof val !== "string" || !val.trim()) return void toast.error(`Nhập "${d.label}"`);
        if (d.key === "label.size" && !/^\d{2,3}x\d{2,3}$/.test(val.trim()))
          return void toast.error("Khổ tem dạng RộngxCao, ví dụ 40x30");
        continue;
      }
      const n = Number(val);
      if (val == null || val === "" || !Number.isFinite(n)) return void toast.error(`Nhập "${d.label}"`);
      if (d.min != null && n < d.min) return void toast.error(`"${d.label}" tối thiểu ${d.min}`);
      if (d.max != null && n > d.max) return void toast.error(`"${d.label}" tối đa ${d.max}`);
    }
    const payload = Object.fromEntries(
      defs.map((d) => [d.key, d.kind === "text" ? String(v[d.key]).trim() : Number(v[d.key])])
    );
    start(async () => {
      const res = await saveSettings(storeId, payload);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Đã lưu cấu hình");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
        {defs.map((d) => (
          <div key={d.key} className="space-y-1.5">
            <Label htmlFor={d.key}>{d.label}</Label>
            {d.kind === "money" ? (
              <MoneyInput
                id={d.key}
                value={v[d.key] == null ? null : Number(v[d.key])}
                onChange={(n) => setV({ ...v, [d.key]: n })}
              />
            ) : (
              <Input
                id={d.key}
                type={d.kind === "number" ? "number" : "text"}
                inputMode={d.kind === "number" ? "decimal" : undefined}
                min={d.min}
                max={d.max}
                value={v[d.key] == null ? "" : String(v[d.key])}
                onChange={(e) => setV({ ...v, [d.key]: e.target.value })}
              />
            )}
            {d.help && <p className="text-xs text-muted-foreground">{d.help}</p>}
          </div>
        ))}
      </fieldset>
      <Button type="submit" className="h-10" disabled={pending}>
        {pending ? "Đang lưu..." : "Lưu cấu hình"}
      </Button>
    </form>
  );
}
