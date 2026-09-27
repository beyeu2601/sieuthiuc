"use client";

import { Info } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from "@/components/ui/dropdown-menu";

type Cat = { id: string; name: string; description?: string | null };

// Nut chu "i" nho: bam vao hien mo ta ngan cua tung nhom hang de nguoi dung de phan biet.
export function CategoryInfo({ categories }: { categories: Cat[] }) {
  const items = categories.filter((c) => c.description?.trim());
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Xem mô tả nhóm hàng"
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Info className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 space-y-2 p-3">
        <p className="text-xs font-medium text-muted-foreground">Mô tả nhóm hàng</p>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Chưa có mô tả. Thêm ở Cài đặt &gt; Nhóm hàng &amp; thương hiệu.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {items.map((c) => (
              <li key={c.id} className="text-sm">
                <span className="font-medium">{c.name}:</span>{" "}
                <span className="text-muted-foreground">{c.description}</span>
              </li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
