import {
  BanknoteIcon,
  BarChart3Icon,
  BoxesIcon,
  ClockIcon,
  HandCoinsIcon,
  HomeIcon,
  PackageIcon,
  PackagePlusIcon,
  ReceiptTextIcon,
  ScanLineIcon,
  SettingsIcon,
  ShoppingCartIcon,
  TruckIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import type { AppRole } from "@/lib/roles";

export type NavItem = {
  label: string;
  // duong dan co {store} se duoc thay bang ma cua hang dang chon
  href: string;
  roles: AppRole[];
  icon: LucideIcon;
};

export type NavGroup = { label: string | null; items: NavItem[] };

const ALL: AppRole[] = ["sadmin", "admin", "accountant", "staff"];
const MANAGERS: AppRole[] = ["sadmin", "admin", "accountant"];

// Nhom theo cong viec, thu tu theo tan suat dung trong ngay.
export const NAV_GROUPS: NavGroup[] = [
  { label: null, items: [{ label: "Tổng quan", href: "/{store}", roles: ALL, icon: HomeIcon }] },
  {
    label: "Bán hàng",
    items: [
      { label: "Bán hàng", href: "/{store}/pos", roles: ["sadmin", "admin", "staff"], icon: ShoppingCartIcon },
      { label: "Giao dịch", href: "/{store}/sales", roles: ALL, icon: ReceiptTextIcon },
      { label: "Đơn online", href: "/{store}/orders", roles: ALL, icon: TruckIcon },
      { label: "Ca", href: "/{store}/shifts", roles: ALL, icon: ClockIcon },
    ],
  },
  {
    label: "Kho",
    items: [
      { label: "Nhập hàng", href: "/{store}/receipts", roles: ALL, icon: PackagePlusIcon },
      { label: "Tồn kho", href: "/{store}/inventory", roles: ALL, icon: BoxesIcon },
      { label: "Tra cứu", href: "/{store}/lookup", roles: ALL, icon: ScanLineIcon },
    ],
  },
  {
    label: "Tài chính",
    items: [
      { label: "Công nợ", href: "/{store}/payables", roles: MANAGERS, icon: HandCoinsIcon },
      { label: "Thu chi", href: "/{store}/cash", roles: ALL, icon: WalletIcon },
      { label: "Báo cáo", href: "/{store}/reports", roles: MANAGERS, icon: BarChart3Icon },
    ],
  },
  {
    label: "Danh mục",
    items: [
      { label: "Sản phẩm", href: "/products", roles: MANAGERS, icon: PackageIcon },
      { label: "Nhà cung cấp", href: "/suppliers", roles: MANAGERS, icon: BanknoteIcon },
    ],
  },
  { label: "Hệ thống", items: [{ label: "Cài đặt", href: "/settings", roles: ["sadmin", "admin"], icon: SettingsIcon }] },
];

// Thanh tab duoi day tren dien thoai: 4 viec hay lam nhat theo vai tro, con lai nam trong "Thêm".
export const MOBILE_TABS: Record<AppRole, string[]> = {
  staff: ["/{store}", "/{store}/pos", "/{store}/lookup", "/{store}/orders"],
  admin: ["/{store}", "/{store}/pos", "/{store}/inventory", "/{store}/reports"],
  sadmin: ["/{store}", "/{store}/pos", "/{store}/inventory", "/{store}/reports"],
  accountant: ["/{store}", "/{store}/payables", "/{store}/cash", "/{store}/reports"],
};
