import { InboxIcon } from "lucide-react";

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed bg-card px-4 py-12 text-center">
      <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand" aria-hidden>
        <InboxIcon className="size-6" />
      </span>
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 max-w-md text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}
