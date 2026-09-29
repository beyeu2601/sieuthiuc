"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { searchCatalog, type CatalogItem } from "@/app/(app)/[store]/catalog-actions";
import { formatMoney, formatNumber } from "@/lib/format";
import { GOODS_TYPE_LABEL } from "@/lib/text";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CameraScanButton } from "@/components/camera-scan-button";

// O tim san pham: go ten (khong dau duoc) hoac quet ma vach roi Enter.
// Quet dung 1 ma vach -> chon ngay, khong can bam.
export function ProductPicker({
  storeId,
  onPick,
  placeholder = "Quét mã vạch hoặc gõ tên sản phẩm, Enter để tìm",
  autoFocus,
  showStock = true,
  camera,
  id,
}: {
  storeId: string;
  onPick: (item: CatalogItem) => void;
  placeholder?: string;
  autoFocus?: boolean;
  showStock?: boolean;
  // hien nut quet ma bang camera tren dien thoai
  camera?: boolean;
  id?: string;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<CatalogItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Dong dang sang khi dung phim len/xuong. -1 = chua chon: Enter giu hanh vi cu
  // (tim va tu chon khi khop dung ma) de may quet ma vach khong bi anh huong.
  const [active, setActive] = useState(-1);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function run(term: string, pickExact: boolean) {
    const t = term.trim();
    if (!t) {
      setItems(null);
      return;
    }
    start(async () => {
      const res = await searchCatalog(storeId, t);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setError(null);
      const rows = res.data ?? [];
      const exact = rows.find((r) => r.barcode?.toUpperCase() === t.toUpperCase() || r.sku.toUpperCase() === t.toUpperCase());
      if (pickExact && (exact || rows.length === 1)) {
        pick(exact ?? rows[0]);
        return;
      }
      setItems(rows);
      setActive(-1);
    });
  }

  function pick(it: CatalogItem) {
    onPick(it);
    setQ("");
    setItems(null);
    setActive(-1);
    inputRef.current?.focus();
  }

  // Dua dong dang sang vao tam nhin khi doi lua chon
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const open = !!items && items.length > 0;

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const input = (
      <Input
        id={id}
        ref={inputRef}
        value={q}
        autoFocus={autoFocus}
        autoComplete="off"
        placeholder={placeholder}
        aria-label="Tìm sản phẩm"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        className="h-11 text-base"
        onChange={(e) => {
          const v = e.target.value;
          setQ(v);
          setActive(-1);
          if (timer.current) clearTimeout(timer.current);
          // go tay: tu tim sau 350ms; may quet go rat nhanh roi Enter nen khong kip kich hoat
          if (v.trim().length >= 2) timer.current = setTimeout(() => run(v, false), 350);
          else setItems(null);
        }}
        onKeyDown={(e) => {
          if (open && e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % items.length);
          } else if (open && e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (timer.current) clearTimeout(timer.current);
            const it = open && active >= 0 ? items[active] : undefined;
            if (it) pick(it);
            else run(q, true);
          } else if (e.key === "Escape") {
            setItems(null);
            setActive(-1);
          }
        }}
      />
  );

  return (
    <div className="relative">
      {camera ? (
        <div className="flex gap-2">
          {input}
          <CameraScanButton
            className="size-11 md:hidden"
            onDetected={(code) => {
              setQ(code);
              run(code, true);
            }}
          />
        </div>
      ) : (
        input
      )}
      {pending && <span className="absolute top-3 right-3 text-xs text-muted-foreground">Đang tìm...</span>}
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
      {items && (
        <div className="absolute z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border bg-popover shadow-lg">
          {items.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              Không tìm thấy sản phẩm &quot;{q}&quot;. Nếu là hàng mới, nhờ quản lý tạo sản phẩm và gán mã vạch.
            </p>
          ) : (
            <ul ref={listRef} id={listId} role="listbox" aria-label="Kết quả tìm sản phẩm">
              {items.map((it, idx) => (
                <li key={it.product_id}>
                  <button
                    type="button"
                    id={`${listId}-${idx}`}
                    role="option"
                    aria-selected={idx === active}
                    data-active={idx === active}
                    onClick={() => pick(it)}
                    onMouseMove={() => setActive(idx)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none",
                      idx === active && "bg-brand-soft text-brand-strong hover:bg-brand-soft"
                    )}
                  >
                    <span>
                      <span className="font-medium">{it.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {it.sku} - {GOODS_TYPE_LABEL[it.goods_type]} - {it.unit}
                        {it.barcode ? ` - ${it.barcode}` : ""}
                      </span>
                    </span>
                    <span className="text-right text-xs whitespace-nowrap">
                      <span className="block font-medium">{formatMoney(it.sell_price)}</span>
                      {showStock && <span className="text-muted-foreground">Còn {formatNumber(it.qty_available)}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
