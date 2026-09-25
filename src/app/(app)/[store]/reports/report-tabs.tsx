"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function ReportTabs({ storeCode }: { storeCode: string }) {
  const pathname = usePathname();
  const items = [
    { href: `/${storeCode}/reports`, label: "Lãi lỗ" },
    { href: `/${storeCode}/reports/cogs`, label: "Giá vốn và lãi gộp" },
    { href: `/${storeCode}/reports/best-sellers`, label: "Bán chạy" },
    { href: `/${storeCode}/reconcile`, label: "Đối soát" },
  ];
  return (
    <nav aria-label="Mục báo cáo" className="overflow-x-auto">
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
