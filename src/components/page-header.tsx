import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";
import { BackButton } from "@/components/back-button";

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  // Nut quay lai: { href, label } ve man cha co dinh; bo trong thi quay ve man vua xem
  back?: { href: string; label?: string };
}) {
  return (
    <div className="mb-5">
      {back ? (
        <Link
          href={back.href}
          className="mb-2 -ml-1 inline-flex h-9 items-center gap-1 rounded-lg px-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronLeftIcon className="size-4" aria-hidden />
          {back.label ?? "Quay lại"}
        </Link>
      ) : (
        <BackButton className="mb-2" />
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-heading text-[28px] leading-tight font-bold tracking-wide lg:text-[32px]">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
