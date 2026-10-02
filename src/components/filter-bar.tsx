"use client";

import { useEffect, useId, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const KEY = "filtersOpen";

// Khung bo loc an/hien duoc. O tim (search) luon hien, cac o loc khac nam trong khung.
// Dat ben trong AutoSubmitForm: o bi an van gui theo form nen loc dang ap khong mat.
// Mac dinh: may tinh mo, dien thoai dong. Lua chon an/hien nho qua localStorage cho moi man.
export function FilterBar({
  search,
  children,
  ignore = ["q", "page", "f", "tab"],
}: {
  search?: React.ReactNode;
  children: React.ReactNode;
  // tham so tren URL khong tinh vao so bo loc dang ap
  ignore?: string[];
}) {
  const sp = useSearchParams();
  const active = new Set([...sp.entries()].filter(([k, v]) => v && !ignore.includes(k)).map(([k]) => k)).size;
  const id = useId();
  // null: chua biet man hinh, dung CSS (an tren dien thoai, hien tren may tinh) de khong nhay giao dien
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch {}
    setOpen(saved ? saved === "1" : matchMedia("(min-width: 768px)").matches);
  }, []);
  function toggle() {
    const next = !(open ?? matchMedia("(min-width: 768px)").matches);
    setOpen(next);
    try {
      localStorage.setItem(KEY, next ? "1" : "0");
    } catch {}
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {search && <div className="min-w-0 flex-1">{search}</div>}
        <Button type="button" variant="outline" aria-expanded={open ?? undefined} aria-controls={id} onClick={toggle} className="h-10">
          {open ? "Ẩn bộ lọc" : "Bộ lọc"}
          {active > 0 && (
            <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs text-primary-foreground" aria-label={`${active} bộ lọc đang áp`}>
              {active}
            </span>
          )}
        </Button>
      </div>
      <div id={id} className={cn(open === null ? "hidden md:block" : open ? "block" : "hidden")}>
        {children}
      </div>
    </div>
  );
}
