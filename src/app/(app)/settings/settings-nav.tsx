"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/settings", label: "Cửa hàng" },
  { href: "/settings/users", label: "Người dùng" },
  { href: "/settings/general", label: "Cấu hình" },
  { href: "/settings/catalog", label: "Nhóm hàng & thương hiệu" },
  { href: "/settings/accounts", label: "Tài khoản tiền", sadminOnly: true },
  // Hang thanh vien tam an, chua ap dung. Trang /settings/loyalty van con nhung khong hien tren nav.
];

export function SettingsNav({ isSadmin }: { isSadmin: boolean }) {
  const pathname = usePathname();
  const items = ITEMS.filter((i) => !i.sadminOnly || isSadmin);
  return (
    <nav aria-label="Mục cài đặt" className="overflow-x-auto">
      <ul className="flex gap-1 border-b">
        {items.map((i) => {
          const active = pathname === i.href;
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex h-10 items-center border-b-2 px-3 text-sm whitespace-nowrap",
                  active ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
