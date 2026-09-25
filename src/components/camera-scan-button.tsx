"use client";

import { useEffect, useRef, useState } from "react";
import { ScanBarcodeIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Quet ma vach bang camera sau cua dien thoai. Doc duoc ma thi goi onDetected;
// khong truyen onDetected thi ghi vao o `name` cua form chua nut va gui form.
export function CameraScanButton({
  name = "q",
  onDetected,
  className,
}: {
  name?: string;
  onDetected?: (code: string) => void;
  className?: string;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // giu ham moi nhat ma khong khoi dong lai camera moi lan component cha ve lai
  const onDetectedRef = useRef(onDetected);
  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    if (!video) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled) return;
        const controls = await new BrowserMultiFormatReader().decodeFromConstraints(
          { video: { facingMode: "environment" } },
          video,
          (result, _err, ctl) => {
            if (!result) return;
            ctl.stop();
            setOpen(false);
            if (onDetectedRef.current) {
              onDetectedRef.current(result.getText());
              return;
            }
            const form = btnRef.current?.closest("form");
            const input = form?.elements.namedItem(name);
            if (form && input instanceof HTMLInputElement) {
              input.value = result.getText();
              form.requestSubmit();
            }
          }
        );
        if (cancelled) controls.stop();
        else stop = () => controls.stop();
      } catch {
        if (!cancelled) setError("Không mở được camera. Hãy cho phép ứng dụng dùng camera trong cài đặt trình duyệt rồi thử lại.");
      }
    })();
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [video, name]);

  return (
    <>
      <Button
        ref={btnRef}
        type="button"
        variant="outline"
        size="icon"
        className={cn("size-10 shrink-0", className)}
        aria-label="Quét mã vạch bằng camera"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <ScanBarcodeIcon />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quét mã vạch</DialogTitle>
            <DialogDescription>Đưa mã vạch vào giữa khung hình, giữ máy yên khoảng một giây.</DialogDescription>
          </DialogHeader>
          {error ? (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          ) : (
            <video ref={setVideo} className="aspect-[4/3] w-full rounded-lg bg-black object-cover" muted playsInline />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
