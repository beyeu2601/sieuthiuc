"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Nut quay lai mac dinh: ve man vua xem (giu bo loc, vi tri); mo thang bang link thi ve fallback.
export function BackButton({ href = "/", label = "Quay lại", className }: { href?: string; label?: string; className?: string }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      onClick={(e) => {
        if (window.history.length > 1) {
          e.preventDefault();
          router.back();
        }
      }}
      className={cn(
        "-ml-1 inline-flex h-9 items-center gap-1 rounded-lg px-1 text-sm font-medium text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      <ChevronLeftIcon className="size-4" aria-hidden />
      {label}
    </Link>
  );
}
