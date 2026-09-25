"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { ChevronsUpDownIcon, LayoutGridIcon, LogOutIcon, StoreIcon, UserRoundIcon } from "lucide-react";
import { logout } from "@/app/login/actions";
import { ROLE_LABEL, type AppRole, type StoreLite } from "@/lib/roles";
import { MOBILE_TABS, NAV_GROUPS, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = {
  fullName: string;
  role: AppRole;
  stores: StoreLite[];
  defaultStoreCode: string | null;
  children: React.ReactNode;
};

type ResolvedItem = NavItem & { key: string; href: string; active: boolean };

export function AppShell({ fullName, role, stores, defaultStoreCode, children }: Props) {
  const params = useParams<{ store?: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const currentCode = params.store ?? defaultStoreCode;
  const current = stores.find((s) => s.code === currentCode) ?? stores[0];
  const home = `/${current?.code ?? ""}`;

  // Doi cua hang: giu nguyen man hinh dang mo neu dang o duoi /[store]/...
  function switchStore(code: string) {
    if (params.store && pathname.startsWith(`/${params.store}`)) {
      router.push(`/${code}${pathname.slice(params.store.length + 1)}`);
    } else {
      router.push(`/${code}`);
    }
  }

  const resolve = (i: NavItem): ResolvedItem => {
    const href = i.href.replace("{store}", current?.code ?? "");
    return { ...i, key: i.href, href, active: pathname === href || (href !== home && pathname.startsWith(href)) };
  };
  const groups = NAV_GROUPS.map((g) => ({ label: g.label, items: g.items.filter((i) => i.roles.includes(role)).map(resolve) })).filter(
    (g) => g.items.length > 0
  );
  const flat = groups.flatMap((g) => g.items);
  const tabs = MOBILE_TABS[role].map((k) => flat.find((i) => i.key === k)).filter(Boolean) as ResolvedItem[];
  const moreActive = !tabs.some((t) => t.active) && flat.some((i) => i.active);

  const storePicker =
    stores.length > 1 ? (
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex h-11 w-full items-center gap-2 rounded-lg border bg-card px-3 text-left text-sm hover:bg-muted"
          aria-label="Chọn cửa hàng"
        >
          <StoreIcon className="size-4 text-brand" aria-hidden />
          <span className="min-w-0 flex-1 truncate font-medium">{current?.name}</span>
          <ChevronsUpDownIcon className="size-4 text-muted-foreground" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {stores.map((s) => (
            <DropdownMenuItem key={s.id} onClick={() => switchStore(s.code)}>
              {s.code} - {s.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    ) : (
      current && (
        <div className="flex items-center gap-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-medium text-brand-strong">
          <StoreIcon className="size-4" aria-hidden />
          <span className="truncate">{current.name}</span>
        </div>
      )
    );

  const accountMenu = (trigger: React.ReactNode, align: "start" | "end") => (
    <DropdownMenu>
      {trigger}
      <DropdownMenuContent align={align} className="min-w-52">
        <div className="px-2 py-1.5">
          <div className="text-sm font-medium">{fullName}</div>
          <div className="text-xs text-muted-foreground">{ROLE_LABEL[role]}</div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="h-10" onClick={() => router.push("/account")}>
          <UserRoundIcon className="size-4" />
          Tài khoản
        </DropdownMenuItem>
        <DropdownMenuItem className="h-10" onClick={() => logout()}>
          <LogOutIcon className="size-4" />
          Đăng xuất
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const navList = (onNavigate?: () => void) => (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g.label ?? "_"}>
          {g.label && <div className="mb-1 px-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{g.label}</div>}
          <ul className="space-y-0.5">
            {g.items.map((i) => (
              <li key={i.key}>
                <Link
                  href={i.href}
                  onClick={onNavigate}
                  aria-current={i.active ? "page" : undefined}
                  className={cn(
                    "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                    i.active ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground/80 hover:bg-brand-soft hover:text-brand-strong"
                  )}
                >
                  <i.icon className="size-[18px] shrink-0" aria-hidden />
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[252px_minmax(0,1fr)]">
      {/* May tinh: thanh ben */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r bg-sidebar lg:flex" aria-label="Điều hướng chính">
        <Link href="/" className="flex items-center gap-2.5 px-5 pt-5 pb-4" aria-label="Siêu Thị Úc - trang chủ">
          <Image src="/brand/logo-mark.png" alt="" width={44} height={40} priority />
          <span className="font-heading text-[26px] leading-none font-bold tracking-wide text-brand uppercase">Siêu Thị Úc</span>
        </Link>
        <div className="px-4 pb-4">{storePicker}</div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">{navList()}</nav>
        <div className="border-t p-3">
          {accountMenu(
            <DropdownMenuTrigger className="flex h-12 w-full items-center gap-3 rounded-lg px-2 text-left hover:bg-muted" aria-label="Tài khoản">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand-strong" aria-hidden>
                {initials(fullName)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{fullName}</span>
                <span className="block truncate text-xs text-muted-foreground">{ROLE_LABEL[role]}</span>
              </span>
              <ChevronsUpDownIcon className="size-4 text-muted-foreground" aria-hidden />
            </DropdownMenuTrigger>,
            "start"
          )}
        </div>
      </aside>

      <div className="min-w-0">
        {/* Dien thoai: thanh tren */}
        <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-card/95 px-4 backdrop-blur lg:hidden">
          <Link href="/" className="flex min-w-0 items-center gap-2" aria-label="Siêu Thị Úc - trang chủ">
            <Image src="/brand/logo-mark.png" alt="" width={34} height={31} priority />
            <span className="truncate font-heading text-xl leading-none font-bold tracking-wide text-brand uppercase">
              {current?.name ?? "Siêu Thị Úc"}
            </span>
          </Link>
          <div className="ml-auto">
            {accountMenu(
              <DropdownMenuTrigger
                className="flex size-11 items-center justify-center rounded-full"
                aria-label={`Tài khoản: ${fullName}`}
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand-strong" aria-hidden>
                  {initials(fullName)}
                </span>
              </DropdownMenuTrigger>,
              "end"
            )}
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 pt-5 pb-28 lg:px-8 lg:pt-8 lg:pb-10">{children}</main>

        {/* Dien thoai: tab duoi day, trong tam ngon cai */}
        <nav
          aria-label="Điều hướng nhanh"
          className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        >
          <ul className="grid grid-cols-5">
            {tabs.map((t) => (
              <li key={t.key}>
                <Link href={t.href} aria-current={t.active ? "page" : undefined} className={tabClass(t.active)}>
                  <t.icon className="size-6" aria-hidden />
                  <span className="truncate">{t.label}</span>
                </Link>
              </li>
            ))}
            <li>
              <button type="button" onClick={() => setMoreOpen(true)} className={cn(tabClass(moreActive), "w-full")} aria-haspopup="dialog">
                <LayoutGridIcon className="size-6" aria-hidden />
                <span>Thêm</span>
              </button>
            </li>
          </ul>
        </nav>
      </div>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent className="top-auto bottom-0 left-0 max-h-[85dvh] max-w-none translate-x-0 translate-y-0 gap-3 overflow-y-auto rounded-t-2xl rounded-b-none p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:max-w-none lg:hidden">
          <DialogTitle className="font-heading text-2xl font-bold">Tất cả chức năng</DialogTitle>
          {storePicker}
          {navList(() => setMoreOpen(false))}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function tabClass(active: boolean) {
  return cn(
    "flex h-16 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium",
    // dang o tab nao: vach tren + chu dam, khong chi dua vao mau
    active
      ? "relative font-semibold text-brand before:absolute before:top-0 before:h-[3px] before:w-10 before:rounded-b-full before:bg-brand"
      : "text-muted-foreground"
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1] ?? "";
  return (last[0] ?? "?").toUpperCase();
}
