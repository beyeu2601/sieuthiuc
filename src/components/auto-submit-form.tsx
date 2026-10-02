"use client";

import { useRef } from "react";
import Form from "next/form";

// Form GET: doi o chon, o tick hoac ngay thi loc ngay, khong can bam nut. O chu van gui bang Enter.
// debounceMs > 0: o chu/tim cung tu loc sau khi ngung go, khong can bam nut Loc.
export function AutoSubmitForm({
  action,
  debounceMs = 0,
  ...props
}: Omit<React.ComponentProps<"form">, "action"> & { action: string; debounceMs?: number }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const later = (form: HTMLFormElement, ms: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => form.requestSubmit(), ms);
  };
  return (
    <Form
      action={action}
      onChange={(e) => {
        const t = e.target as unknown as HTMLInputElement;
        const form = e.currentTarget;
        if (t.tagName === "SELECT" || t.type === "checkbox" || t.type === "radio") {
          if (timer.current) clearTimeout(timer.current);
          form.requestSubmit();
          return;
        }
        // O ngay: go tay tung so cung phat change, cho ngung go roi moi loc
        if (t.type === "date") return later(form, 700);
        // O chu/tim: tu loc sau khi ngung go
        if (debounceMs > 0 && (t.type === "search" || t.type === "text")) later(form, debounceMs);
      }}
      {...props}
    />
  );
}
