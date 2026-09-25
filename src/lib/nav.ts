import type { AppRole } from "@/lib/roles";

export type NavItem = {
  label: string;
  // duong dan co {store} se duoc thay bang ma cua hang dang chon
  href: string;
  roles: AppRole[];
};

// Chi liet ke man hinh da xay xong. Sprint sau bo sung.
export const NAV_ITEMS: NavItem[] = [
  { label: "Tổng quan", href: "/{store}", roles: ["sadmin", "admin", "accountant", "staff"] },
  { label: "Cài đặt", href: "/settings", roles: ["sadmin", "admin"] },
];
