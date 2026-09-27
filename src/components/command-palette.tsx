"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { SearchIcon, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { searchKey } from "@/lib/text";

// Mot dong ket qua: menu da giai href va loc theo vai tro tu AppShell.
export type PaletteItem = { label: string; href: string; icon: LucideIcon; group: string | null };

const OPEN_EVENT = "open-command-palette";

// Mo bang tim tu nut tren khung app (thanh ben may tinh, header dien thoai).
export function openCommandPalette() {
  document.dispatchEvent(new Event(OPEN_EVENT));
}

// Tim nhanh mot menu bat ky. Ctrl/Cmd+K mo, go de loc khong dau, len xuong chon,
// Enter di toi. Tu loc bang searchKey vi cach nay hieu tieng Viet co dau.
export function CommandPalette({ items }: { items: PaletteItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    function onOpen() {
      setOpen(true);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  const key = searchKey(q);
  const results = useMemo(
    () =>
      key === "" ? items : items.filter((i) => searchKey(`${i.label} ${i.group ?? ""}`).includes(key)),
    [items, key]
  );

  // Dua dong dang chon vao trong tam nhin khi doi lua chon.
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active, results]);

  function close() {
    setOpen(false);
    setQ("");
    setActive(0);
  }
  function go(href: string) {
    close();
    router.push(href);
  }

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = results[active];
      if (it) go(it.href);
    }
  }

  let lastGroup: string | null | undefined = undefined;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/10 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup className="fixed top-[12vh] left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 overflow-hidden rounded-xl bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
          <DialogPrimitive.Title className="sr-only">Tìm nhanh menu</DialogPrimitive.Title>
          <div className="flex items-center gap-2 border-b px-3">
            <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              autoFocus
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={onInputKeyDown}
              placeholder="Tìm màn hình, chức năng..."
              aria-label="Tìm nhanh menu"
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div ref={listRef} className="max-h-[min(24rem,60vh)] overflow-y-auto p-2">
            {results.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">Không tìm thấy chức năng nào khớp.</p>
            ) : (
              results.map((it, idx) => {
                const showHeading = it.group !== lastGroup;
                lastGroup = it.group;
                return (
                  <Fragment key={it.href}>
                    {showHeading && it.group ? (
                      <div className="px-2 pt-2 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        {it.group}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      data-active={idx === active}
                      onClick={() => go(it.href)}
                      onMouseMove={() => setActive(idx)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm",
                        idx === active ? "bg-brand-soft text-brand-strong" : "text-foreground"
                      )}
                    >
                      <it.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{it.label}</span>
                    </button>
                  </Fragment>
                );
              })
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
