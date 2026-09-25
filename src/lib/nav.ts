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
  { label: "Bán hàng", href: "/{store}/pos", roles: ["sadmin", "admin", "staff"] },
  { label: "Giao dịch", href: "/{store}/sales", roles: ["sadmin", "admin", "accountant", "staff"] },
  { label: "Ca", href: "/{store}/shifts", roles: ["sadmin", "admin", "accountant", "staff"] },
  { label: "Nhập hàng", href: "/{store}/receipts", roles: ["sadmin", "admin", "accountant", "staff"] },
  { label: "Tồn kho", href: "/{store}/inventory", roles: ["sadmin", "admin", "accountant", "staff"] },
  { label: "Tra cứu", href: "/{store}/lookup", roles: ["sadmin", "admin", "accountant", "staff"] },
  { label: "Sản phẩm", href: "/products", roles: ["sadmin", "admin", "accountant"] },
  { label: "Nhà cung cấp", href: "/suppliers", roles: ["sadmin", "admin", "accountant"] },
  { label: "Cài đặt", href: "/settings", roles: ["sadmin", "admin"] },
];
