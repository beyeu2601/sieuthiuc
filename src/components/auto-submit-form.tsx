"use client";

import Form from "next/form";

// Form GET: doi o chon hoac o tick thi loc ngay, khong can bam nut. O chu van gui bang Enter.
export function AutoSubmitForm({ action, ...props }: Omit<React.ComponentProps<"form">, "action"> & { action: string }) {
  return (
    <Form
      action={action}
      onChange={(e) => {
        const t = e.target as unknown as HTMLInputElement;
        if (t.tagName === "SELECT" || t.type === "checkbox") e.currentTarget.requestSubmit();
      }}
      {...props}
    />
  );
}
