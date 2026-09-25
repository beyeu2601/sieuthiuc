import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const productImageUrl = (fileId: string) => `/api/product-images/${fileId}`;

// Anh dai dien vuong trong danh sach; chua co anh thi hien o xam co bieu tuong.
export function ProductThumb({ fileId, size = 48, className }: { fileId?: string | null; size?: number; className?: string }) {
  const box = cn("shrink-0 overflow-hidden rounded-lg border bg-muted", className);
  if (!fileId) {
    return (
      <span className={cn(box, "flex items-center justify-center text-muted-foreground/60")} style={{ width: size, height: size }} aria-hidden>
        <ImageIcon className="size-1/2" />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- anh qua route rieng, da thu nho san
    <img src={productImageUrl(fileId)} alt="" width={size} height={size} loading="lazy" decoding="async" className={cn(box, "object-cover")} />
  );
}
