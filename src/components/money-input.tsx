"use client";

import { Input } from "@/components/ui/input";

const fmt = new Intl.NumberFormat("vi-VN");

// O nhap tien VND: hien thi dau cham nghin, gia tri la so nguyen.
export function MoneyInput({
  value,
  onChange,
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
}) {
  return (
    <Input
      {...props}
      inputMode="numeric"
      value={value == null ? "" : fmt.format(value)}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "");
        onChange(digits === "" ? null : Number(digits));
      }}
      className={`text-right tabular-nums ${props.className ?? ""}`}
    />
  );
}
