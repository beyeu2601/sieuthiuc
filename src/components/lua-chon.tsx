"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import { NativeSelect } from "@/components/native-select";

export type PhuongAn = { value: string; label: string; disabled?: boolean };

/*
 * Chon mot gia tri (khach chot 02/10/2026): tu 3 phuong an tro xuong hien thanh
 * nut bam chon ngay, tren 3 moi la danh sach tha xuong. Dung duoc ca hai kieu:
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
      <NativeSelect
        id={id}
        name={name}
        aria-label={ariaLabel}
        disabled={disabled}
        required={required}
        className={className}
        {...(value !== undefined ? { value } : { defaultValue })}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
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
