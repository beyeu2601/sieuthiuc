"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { ChevronDownIcon, LogOutIcon, StoreIcon } from "lucide-react";
import { logout } from "@/app/login/actions";
import { ROLE_LABEL, type AppRole, type StoreLite } from "@/lib/roles";
import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";
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
};

export function AppHeader({ fullName, role, stores, defaultStoreCode }: Props) {
  const params = useParams<{ store?: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const currentCode = params.store ?? defaultStoreCode;
  const current = stores.find((s) => s.code === currentCode) ?? stores[0];

  // Doi cua hang: giu nguyen man hinh dang mo neu dang o duoi /[store]/...
  function switchStore(code: string) {
    if (params.store && pathname.startsWith(`/${params.store}`)) {
      router.push(`/${code}${pathname.slice(params.store.length + 1)}`);
    } else {
      router.push(`/${code}`);
    }
  }

  const items = NAV_ITEMS.filter((i) => i.roles.includes(role)).map((i) => ({
    ...i,
    href: i.href.replace("{store}", current?.code ?? ""),
  }));

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
        <Link href="/" className="font-semibold whitespace-nowrap">
          Siêu Thị Úc
        </Link>

        {stores.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-sm"
              aria-label="Chọn cửa hàng"
            >
              <StoreIcon className="size-4" />
              <span className="max-w-40 truncate">{current?.name}</span>
              <ChevronDownIcon className="size-4 text-muted-foreground" />
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
            <span className="hidden items-center gap-1.5 text-sm text-muted-foreground sm:flex">
              <StoreIcon className="size-4" />
              {current.name}
            </span>
          )
        )}

        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm hover:bg-muted"
              aria-label="Tài khoản"
            >
              <span className="max-w-32 truncate">{fullName}</span>
              <ChevronDownIcon className="size-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="px-2 py-1.5 text-xs text-muted-foreground">{ROLE_LABEL[role]}</div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/account")}>Tài khoản</DropdownMenuItem>
              <DropdownMenuItem onClick={() => logout()}>
                <LogOutIcon className="size-4" />
                Đăng xuất
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <nav aria-label="Điều hướng chính" className="mx-auto max-w-7xl overflow-x-auto px-2">
        <ul className="flex gap-1 pb-2">
          {items.map((i) => {
            const active = pathname === i.href || (i.href !== `/${current?.code}` && pathname.startsWith(i.href));
            return (
              <li key={i.href}>
                <Link
                  href={i.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-9 items-center rounded-lg px-3 text-sm whitespace-nowrap",
                    active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  )}
                >
                  {i.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
