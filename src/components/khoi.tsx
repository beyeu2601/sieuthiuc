import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { GoiY } from "@/components/goi-y";

/** Khoi noi dung co tieu de ngan, khong cau mo ta. `aside` dat goc phai (so dem, nut nho), huong dan dai dua vao `goiY` (nut i). */
export function Khoi({
  title,
  aside,
  icon: Icon,
  goiY,
  children,
  className,
}: {
  title: string;
  aside?: React.ReactNode;
  icon?: LucideIcon;
  goiY?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border bg-card p-4", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {Icon && <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />}
          <h2 className="font-medium">{title}</h2>
          {goiY && <GoiY label={title}>{goiY}</GoiY>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}
