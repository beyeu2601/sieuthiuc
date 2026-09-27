"use client";

import { useRef } from "react";
import Form from "next/form";

// Form GET: doi o chon hoac o tick thi loc ngay, khong can bam nut. O chu van gui bang Enter.
// debounceMs > 0: o chu/tim cung tu loc sau khi ngung go, khong can bam nut Loc.
export function AutoSubmitForm({
  action,
  debounceMs = 0,
  ...props
}: Omit<React.ComponentProps<"form">, "action"> & { action: string; debounceMs?: number }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (
    <Form
      action={action}
      onChange={(e) => {
        const t = e.target as unknown as HTMLInputElement;
        const form = e.currentTarget;
        if (t.tagName === "SELECT" || t.type === "checkbox") {
          if (timer.current) clearTimeout(timer.current);
          form.requestSubmit();
          return;
        }
        // O chu/tim: tu loc sau khi ngung go
        if (debounceMs > 0 && (t.type === "search" || t.type === "text")) {
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => form.requestSubmit(), debounceMs);
        }
      }}
      {...props}
    />
  );
}
