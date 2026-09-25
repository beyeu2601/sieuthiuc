"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function InventoryTabs({ storeCode }: { storeCode: string }) {
  const pathname = usePathname();
  const items = [
    { href: `/${storeCode}/inventory`, label: "Tồn hiện tại" },
    { href: `/${storeCode}/inventory/period`, label: "Nhập xuất tồn theo kỳ" },
    { href: `/${storeCode}/inventory/low`, label: "Cần nhập thêm" },
    { href: `/${storeCode}/inventory/movements`, label: "Lịch sử biến động" },
    { href: `/${storeCode}/expiry`, label: "Hạn sử dụng" },
    { href: `/${storeCode}/transfers`, label: "Chuyển kho" },
  ];
  return (
    <nav aria-label="Mục kho" className="overflow-x-auto">
      <ul className="flex gap-1 border-b">
        {items.map((i) => (
          <li key={i.href}>
            <Link
              href={i.href}
              aria-current={pathname === i.href ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex h-10 items-center border-b-2 px-3 text-sm whitespace-nowrap",
                pathname === i.href ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
