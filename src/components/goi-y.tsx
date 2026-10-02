"use client";

import { Info } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from "@/components/ui/dropdown-menu";

/*
 * Nut (i) nho canh nhan: bam (ca tren dien thoai) de xem cach tinh hoac huong dan.
 * Dung cho cho co logic an, thay cho cau mo ta dai tren trang (CLAUDE.md muc 8).
 */
export function GoiY({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Giải thích: ${label}`}
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Info className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 space-y-1.5 p-3 text-sm">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
