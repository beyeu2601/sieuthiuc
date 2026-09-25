import Link from "next/link";
import type { StoreLite } from "@/lib/roles";
import { cn } from "@/lib/utils";

export function ScopePicker({
  basePath,
  stores,
  current,
  allowGlobal,
}: {
  basePath: string;
  stores: StoreLite[];
  current: string | null;
  allowGlobal: boolean;
}) {
  const opts = [
    ...(allowGlobal ? [{ id: null as string | null, label: "Chung" }] : []),
    ...stores.map((s) => ({ id: s.id as string | null, label: `Cửa hàng ${s.code}` })),
  ];
  if (opts.length <= 1) return null;
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Phạm vi áp dụng">
      {opts.map((o) => (
        <Link
          key={o.id ?? "global"}
          href={o.id ? `${basePath}?scope=${o.id}` : basePath}
          aria-current={o.id === current ? "true" : undefined}
          className={cn(
            "inline-flex h-8 items-center rounded-lg border px-3 text-sm",
            o.id === current ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
          )}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}
