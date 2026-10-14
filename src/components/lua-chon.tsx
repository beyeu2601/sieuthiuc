"use client";

import { useId, useRef, useState } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { searchKey } from "@/lib/text";

export type PhuongAn = { value: string; label: string; disabled?: boolean };

/*
 * Chon mot gia tri (khach chot 02/10/2026): tu 3 phuong an tro xuong hien thanh
 * nut bam chon ngay, tren 3 moi la danh sach tha xuong co o tim (khach yeu cau
 * 14/10/2026: go de loc thay vi cuon). Dung duoc ca hai kieu:
 * - co value + onChange (form client);
 * - name + defaultValue trong AutoSubmitForm (radio/select doi la loc ngay).
 * Nut bam la radio that nen phim mui ten, Tab, trinh doc man hinh va submit form
 * deu chay nhu o chon goc.
 */
export function LuaChon({
  options,
  value,
  defaultValue,
  onChange,
  name,
  id,
  disabled,
  required,
  className,
  "aria-label": ariaLabel,
}: {
  options: PhuongAn[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const autoName = useId();

  if (options.length > 3) {
    return (
      <DanhSachTim
        options={options}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        name={name}
        id={id}
        disabled={disabled}
        required={required}
        className={className}
        aria-label={ariaLabel}
      />
    );
  }

  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("flex min-h-10 w-full flex-wrap gap-1 rounded-lg border border-input bg-muted/50 p-1", className)}
    >
      {options.map((o) => (
        <label
          key={o.value}
          className="flex min-h-8 flex-1 cursor-pointer items-center justify-center rounded-md px-3 py-1 text-center text-sm leading-tight text-muted-foreground transition-colors select-none hover:bg-card hover:text-foreground has-[:checked]:bg-primary has-[:checked]:font-medium has-[:checked]:text-primary-foreground has-[:checked]:shadow-sm has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 max-lg:min-h-9"
        >
          <input
            type="radio"
            className="sr-only"
            name={name ?? autoName}
            value={o.value}
            disabled={disabled || o.disabled}
            required={required}
            {...(value !== undefined ? { checked: value === o.value } : { defaultChecked: defaultValue === o.value })}
            onChange={onChange ? () => onChange(o.value) : undefined}
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}

// Moi tu go phai co trong nhan (bo dau, khong can dung thu tu), giong o tim san pham
function khop(o: PhuongAn, query: string) {
  const words = searchKey(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const key = searchKey(o.label);
  return words.every((w) => key.includes(w));
}

function DanhSachTim({
  options,
  value,
  defaultValue,
  onChange,
  name,
  id,
  disabled,
  required,
  className,
  "aria-label": ariaLabel,
}: {
  options: PhuongAn[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const [inner, setInner] = useState(defaultValue ?? options[0]?.value ?? "");
  const current = value !== undefined ? value : inner;
  const selected = options.find((o) => o.value === current) ?? null;
  const selectRef = useRef<HTMLSelectElement>(null);

  function pick(o: PhuongAn | null) {
    if (!o || o.value === current) return;
    if (value === undefined) setInner(o.value);
    onChange?.(o.value);
    // O select an giu name cho form: phat su kien change de AutoSubmitForm loc ngay nhu select goc
    const sel = selectRef.current;
    if (sel) {
      sel.value = o.value;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  return (
    <>
      <Combobox.Root
        items={options}
        value={selected}
        onValueChange={(o) => pick(o as PhuongAn | null)}
        itemToStringLabel={(o: PhuongAn) => o.label}
        isItemEqualToValue={(a: PhuongAn, b: PhuongAn) => a.value === b.value}
        filter={(o: PhuongAn, q: string) => khop(o, q)}
        autoHighlight
        disabled={disabled}
      >
        <Combobox.Trigger
          id={id}
          aria-label={ariaLabel}
          className={cn(
            "flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-left text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-popup-open:border-ring",
            className
          )}
        >
          <span className="truncate">{selected?.label ?? ""}</span>
          <ChevronDownIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        </Combobox.Trigger>
        <Combobox.Portal>
          <Combobox.Positioner sideOffset={4} align="start" className="isolate z-50">
            <Combobox.Popup className="flex max-h-[min(var(--available-height),22rem)] w-(--anchor-width) min-w-56 flex-col overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 motion-safe:duration-100 data-open:motion-safe:animate-in data-open:motion-safe:fade-in-0 data-closed:motion-safe:animate-out data-closed:motion-safe:fade-out-0">
              <div className="flex items-center gap-2 border-b px-3">
                <SearchIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                <Combobox.Input
                  placeholder="Gõ để tìm..."
                  aria-label={ariaLabel ? `Tìm ${ariaLabel.toLocaleLowerCase("vi")}` : "Tìm"}
                  className="h-10 w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm"
                />
              </div>
              <Combobox.Empty className="px-3 py-2 text-sm text-muted-foreground empty:hidden">Không có kết quả</Combobox.Empty>
              <Combobox.List className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1 empty:hidden">
                {(o: PhuongAn) => (
                  <Combobox.Item
                    key={o.value}
                    value={o}
                    disabled={o.disabled}
                    className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                  >
                    <span className="flex-1">{o.label}</span>
                    <Combobox.ItemIndicator>
                      <CheckIcon aria-hidden className="size-4" />
                    </Combobox.ItemIndicator>
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
      {name && (
        <select
          ref={selectRef}
          name={name}
          value={current}
          required={required}
          onChange={() => {}}
          tabIndex={-1}
          aria-hidden
          className="sr-only"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </>
  );
}
