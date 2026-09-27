"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveBrand, saveCategory } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Category = { id: string; name: string; is_active: boolean; description: string | null };

function CategoryRow({ row, onSaved }: { row: Category | null; onSaved: () => void }) {
  const [name, setName] = useState(row?.name ?? "");
  const [active, setActive] = useState(row?.is_active ?? true);
  const [description, setDescription] = useState(row?.description ?? "");
  const [pending, start] = useTransition();
  const dirty = !row || name !== row.name || active !== row.is_active || description !== (row.description ?? "");

  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await saveCategory(row?.id ?? null, { name, is_active: active, description });
      if (!res.ok) return void toast.error(res.error);
      toast.success(row ? "Đã lưu nhóm hàng" : "Đã thêm nhóm hàng");
      if (!row) {
        setName("");
        setDescription("");
      }
      onSaved();
    });
  }

  return (
    <form onSubmit={save} className="space-y-1.5 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Tên nhóm hàng"
          placeholder={row ? "" : "Tên nhóm mới"}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-40 flex-1"
        />
        {row && (
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" className="size-4" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Dùng
          </label>
        )}
        <Button type="submit" size="sm" variant={row ? "outline" : "default"} disabled={pending || !dirty || !name.trim()}>
          {row ? "Lưu" : "Thêm"}
        </Button>
      </div>
      <Input
        aria-label="Mô tả nhóm hàng"
        placeholder="Mô tả ngắn (giúp phân biệt các nhóm)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="text-sm"
      />
    </form>
  );
}

export function CategoryEditor({ rows }: { rows: Category[] }) {
  const router = useRouter();
  return (
    <div className="divide-y">
      <CategoryRow row={null} onSaved={() => router.refresh()} />
      {rows.map((r) => (
        <CategoryRow key={`${r.id}-${r.name}-${r.is_active}`} row={r} onSaved={() => router.refresh()} />
      ))}
    </div>
  );
}

function BrandRow({ row, onSaved }: { row: { id: string; name: string } | null; onSaved: () => void }) {
  const [name, setName] = useState(row?.name ?? "");
  const [pending, start] = useTransition();
  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await saveBrand(row?.id ?? null, name);
      if (!res.ok) return void toast.error(res.error);
      toast.success(row ? "Đã lưu thương hiệu" : "Đã thêm thương hiệu");
      if (!row) setName("");
      onSaved();
    });
  }
  return (
    <form onSubmit={save} className="flex items-center gap-2 py-2">
      <Input
        aria-label="Tên thương hiệu"
        placeholder={row ? "" : "Tên thương hiệu mới"}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="flex-1"
      />
      <Button
        type="submit"
        size="sm"
        variant={row ? "outline" : "default"}
        disabled={pending || !name.trim() || (row != null && name === row.name)}
      >
        {row ? "Lưu" : "Thêm"}
      </Button>
    </form>
  );
}

export function BrandEditor({ rows }: { rows: { id: string; name: string }[] }) {
  const router = useRouter();
  return (
    <div className="divide-y">
      <BrandRow row={null} onSaved={() => router.refresh()} />
      {rows.map((r) => (
        <BrandRow key={`${r.id}-${r.name}`} row={r} onSaved={() => router.refresh()} />
      ))}
    </div>
  );
}
