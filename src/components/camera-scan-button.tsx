"use client";

import { useEffect, useRef, useState } from "react";
import { ScanBarcodeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Quet ma vach bang camera sau cua dien thoai. Doc duoc ma thi ghi vao o `name` cua form chua nut va gui form.
export function CameraScanButton({ name = "q" }: { name?: string }) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
            const form = btnRef.current?.closest("form");
            const input = form?.elements.namedItem(name);
            if (form && input instanceof HTMLInputElement) {
              input.value = result.getText();
              form.requestSubmit();
            }
            setOpen(false);
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
        className="size-10 shrink-0"
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
