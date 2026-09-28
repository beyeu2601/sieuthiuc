import { cn } from "cn";

/**
 * Khoi xam nhap nhay cho moi trang thai dang tai.
 *
 * Nen lay `foreground/10`: du dam de thay tren ca card trang va nen `background`,
 * va tu doi theo dark mode (foreground la muc o ban sang, sang o ban toi).
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-foreground/10", className)}
    />
  );
}
