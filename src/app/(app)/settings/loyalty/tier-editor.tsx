"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteTier, saveTier, type TierInput } from "../actions";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Tier = TierInput & { id: string };

function TierRow({ row, nextRank, onSaved }: { row: Tier | null; nextRank: number; onSaved: () => void }) {
  const [v, setV] = useState<TierInput>(
    row ?? { name: "", rank: nextRank, min_total_spent: 0, earn_multiplier: 1, discount_pct: 0 }
  );
  const [pending, start] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await saveTier(row?.id ?? null, { ...v, earn_multiplier: Number(v.earn_multiplier), discount_pct: Number(v.discount_pct) });
      if (!res.ok) return void toast.error(res.error);
      toast.success(row ? "Đã lưu hạng" : "Đã thêm hạng");
      onSaved();
    });
  }

  function remove() {
    if (!row || !confirm(`Xóa hạng ${row.name}?`)) return;
    start(async () => {
      const res = await deleteTier(row.id);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Đã xóa hạng");
      onSaved();
    });
  }

  return (
    <form onSubmit={save} className="grid grid-cols-2 items-end gap-2 py-3 sm:grid-cols-[1fr_150px_100px_100px_auto]">
      <label className="space-y-1 text-xs text-muted-foreground">
        Tên hạng
        <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Tên hạng mới" />
      </label>
      <label className="space-y-1 text-xs text-muted-foreground">
        Chi tiêu từ (₫)
        <MoneyInput value={v.min_total_spent} onChange={(n) => setV({ ...v, min_total_spent: n ?? 0 })} />
      </label>
      <label className="space-y-1 text-xs text-muted-foreground">
        Hệ số điểm
        <Input
          type="number"
          step="0.1"
          min={0.1}
          value={v.earn_multiplier}
          onChange={(e) => setV({ ...v, earn_multiplier: e.target.value as unknown as number })}
        />
      </label>
      <label className="space-y-1 text-xs text-muted-foreground">
        Giảm giá %
        <Input
          type="number"
          step="0.5"
          min={0}
          max={100}
          value={v.discount_pct}
          onChange={(e) => setV({ ...v, discount_pct: e.target.value as unknown as number })}
        />
      </label>
      <div className="col-span-2 flex gap-1 sm:col-span-1">
        <Button type="submit" size="sm" variant={row ? "outline" : "default"} disabled={pending || !v.name.trim()}>
          {row ? "Lưu" : "Thêm"}
        </Button>
        {row && row.rank > 0 && (
          <Button type="button" size="sm" variant="ghost" className="text-destructive" disabled={pending} onClick={remove}>
            Xóa
          </Button>
        )}
      </div>
    </form>
  );
}

export function TierEditor({ rows }: { rows: Tier[] }) {
  const router = useRouter();
  const nextRank = rows.reduce((m, r) => Math.max(m, r.rank), -1) + 1;
  return (
    <div className="divide-y">
      {rows.map((r) => (
        <TierRow key={`${r.id}-${r.name}-${r.min_total_spent}-${r.earn_multiplier}-${r.discount_pct}`} row={r} nextRank={nextRank} onSaved={() => router.refresh()} />
      ))}
      <TierRow key={`new-${nextRank}`} row={null} nextRank={nextRank} onSaved={() => router.refresh()} />
    </div>
  );
}
