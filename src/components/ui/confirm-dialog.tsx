"use client";

import * as React from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Thao tac khong hoan tac duoc (xoa, huy): nut xac nhan mau do. */
  danger?: boolean;
};

/**
 * Hop thoai hoi lai truoc thao tac quan trong. Thay `confirm()` goc trinh duyet
 * (khong theo giao dien app, khong dark mode, chan luong tren mobile). Khac
 * `Dialog` thuong: khong dong duoc bang Esc hay bam ra ngoai (dung AlertDialog),
 * de nguoi dung khong lo tay bo qua.
 */
function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
  danger = false,
}: ConfirmOptions & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <AlertDialog.Popup
          className={cn(
            "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-3 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          )}
        >
          <AlertDialog.Title className="font-heading text-base leading-none font-medium">
            {title}
          </AlertDialog.Title>
          {description ? (
            <AlertDialog.Description className="text-sm whitespace-pre-line text-muted-foreground">
              {description}
            </AlertDialog.Description>
          ) : null}
          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Close render={<Button variant="outline" />}>
              {cancelLabel}
            </AlertDialog.Close>
            <Button
              variant={danger ? "destructive" : "default"}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

/**
 * Bọc `ConfirmDialog` thành một hàm `confirm()` trả Promise, để chỗ gọi thay
 * `confirm()` goc gần như không đổi cấu trúc:
 *
 *   const { confirm, dialog } = useConfirm();
 *   ...
 *   if (await confirm({ title: "Xóa?" })) run();
 *   ...
 *   return <>{...}{dialog}</>;
 */
export function useConfirm() {
  const [opts, setOpts] = React.useState<ConfirmOptions>({ title: "" });
  const [open, setOpen] = React.useState(false);
  const resolverRef = React.useRef<((v: boolean) => void) | null>(null);

  const settle = React.useCallback((v: boolean) => {
    setOpen(false);
    resolverRef.current?.(v);
    resolverRef.current = null;
  }, []);

  const confirm = React.useCallback((next: ConfirmOptions) => {
    setOpts(next);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const dialog = (
    <ConfirmDialog
      {...opts}
      open={open}
      onOpenChange={(o) => {
        if (!o) settle(false);
      }}
      onConfirm={() => settle(true)}
    />
  );

  return { confirm, dialog };
}

export { ConfirmDialog };
