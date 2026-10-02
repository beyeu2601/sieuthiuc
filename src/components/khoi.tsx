import { cn } from "@/lib/utils";

/** Khoi noi dung co tieu de ngan, khong cau mo ta. `aside` dat goc phai (so dem, nut nho). */
export function Khoi({
  title,
  aside,
  children,
  className,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border bg-card p-4", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-medium">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
