"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlusIcon } from "lucide-react";
import { toast } from "sonner";
import { deleteProductImage, setProductThumbnail, uploadProductImage } from "../image-actions";
import { productImageUrl } from "@/components/product-thumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type Img = { id: string; drive_file_id: string; drive_thumb_id: string; is_thumbnail: boolean };

const MAX = 10;

// Thu nho o trinh duyet truoc khi gui: anh dien thoai 4-12MB xuong con vai tram KB.
async function toJpeg(file: File, square: boolean, size: number): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  let sx = 0, sy = 0, sw = bmp.width, sh = bmp.height;
  if (square) {
    const s = Math.min(sw, sh);
    sx = (sw - s) / 2;
    sy = (sh - s) / 2;
    sw = sh = s;
  }
  const scale = Math.min(1, size / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  canvas.getContext("2d")!.drawImage(bmp, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/jpeg", square ? 0.8 : 0.85)
  );
}

export function ImageGallery({
  productId,
  productName,
  images,
  canEdit,
  configured,
}: {
  productId: string;
  productName: string;
  images: Img[];
  canEdit: boolean;
  configured: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [open, setOpen] = useState<Img | null>(null);
  const [pending, start] = useTransition();

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const all = Array.from(e.target.files ?? []);
    e.target.value = "";
    const room = MAX - images.length;
    const files = all.slice(0, room);
    if (all.length > room) toast.warning(`Chỉ thêm được ${room} ảnh nữa (tối đa ${MAX} ảnh).`);
    let ok = 0;
    for (const [i, f] of files.entries()) {
      setProgress(`Đang tải ${i + 1}/${files.length}`);
      try {
        const form = new FormData();
        form.append("full", await toJpeg(f, false, 1600));
        form.append("thumb", await toJpeg(f, true, 400));
        const res = await uploadProductImage(productId, form);
        if (!res.ok) {
          toast.error(res.error);
          break;
        }
        ok++;
      } catch {
        toast.error(`Không đọc được ảnh ${f.name}. Chọn ảnh JPG hoặc PNG.`);
      }
    }
    setProgress(null);
    if (ok) toast.success(`Đã thêm ${ok} ảnh`);
  }

  function act(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(success);
        setOpen(null);
      } else toast.error(res.error);
    });
  }

  if (!configured) {
    return <p className="text-sm text-muted-foreground">Chưa kết nối Google Drive nên chưa lưu được ảnh. Liên hệ quản trị hệ thống.</p>;
  }

  const busy = progress !== null;

  return (
    <div className="space-y-3">
      {images.length === 0 && !canEdit && <p className="text-sm text-muted-foreground">Chưa có ảnh.</p>}
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5" aria-label={`Ảnh của ${productName}`}>
        {images.map((img, i) => (
          <li key={img.id} className="relative">
            <button
              type="button"
              onClick={() => setOpen(img)}
              className="block aspect-square w-full overflow-hidden rounded-lg border bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              aria-label={`Xem ảnh ${i + 1}${img.is_thumbnail ? ", ảnh đại diện" : ""}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- anh qua route rieng */}
              <img src={productImageUrl(img.drive_thumb_id)} alt="" loading="lazy" className="size-full object-cover" />
            </button>
            {img.is_thumbnail && <Badge className="pointer-events-none absolute bottom-1.5 left-1.5">Đại diện</Badge>}
          </li>
        ))}
        {canEdit && images.length < MAX && (
          <li>
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-input text-sm text-muted-foreground hover:border-brand hover:text-brand disabled:opacity-60"
            >
              <ImagePlusIcon className="size-6" aria-hidden />
              <span>{progress ?? "Thêm ảnh"}</span>
              {!busy && <span className="text-xs tabular-nums">{images.length}/{MAX}</span>}
            </button>
          </li>
        )}
      </ul>
      {canEdit && images.length > 1 && (
        <p className="text-xs text-muted-foreground">Bấm vào ảnh để xem lớn, đặt làm ảnh đại diện hoặc xóa.</p>
      )}
      <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={onPick} />

      <Dialog open={open !== null} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="gap-3 sm:max-w-2xl">
          <DialogTitle className="pr-8 text-lg leading-snug">{productName}</DialogTitle>
          {open && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- anh qua route rieng */}
              <img
                src={productImageUrl(open.drive_file_id)}
                alt={productName}
                className="max-h-[65dvh] w-full rounded-lg bg-muted object-contain"
              />
              {canEdit && (
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    variant="destructive"
                    disabled={pending}
                    onClick={() => {
                      if (confirm("Xóa ảnh này? Ảnh được chuyển vào thùng rác Google Drive.")) {
                        act(() => deleteProductImage(productId, open.id), "Đã xóa ảnh");
                      }
                    }}
                  >
                    Xóa ảnh
                  </Button>
                  {!open.is_thumbnail && (
                    <Button disabled={pending} onClick={() => act(() => setProductThumbnail(productId, open.id), "Đã đặt làm ảnh đại diện")}>
                      Đặt làm ảnh đại diện
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
