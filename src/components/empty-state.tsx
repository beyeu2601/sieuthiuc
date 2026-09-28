import { InboxIcon, type LucideIcon } from "lucide-react";

/**
 * Trang thai rong: bieu tuong, tieu de, giai thich, va (tuy chon) mot nut goi
 * hanh dong de nguoi dung biet lam gi tiep. Icon mac dinh la hop thu; truyen
 * `icon` de hop ngu canh (vd Package cho kho, Receipt cho phieu).
 */
export function EmptyState({
  title,
  children,
  icon: Icon = InboxIcon,
  action,
}: {
  title: string;
  children?: React.ReactNode;
  icon?: LucideIcon;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed bg-card px-4 py-12 text-center">
      <span
        className="mb-3 flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand"
        aria-hidden
      >
        <Icon className="size-6" />
      </span>
      <p className="font-medium">{title}</p>
      {children && (
        <div className="mt-1 max-w-md text-sm text-muted-foreground">{children}</div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
