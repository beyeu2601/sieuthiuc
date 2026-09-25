"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { transferAction } from "../actions";
import { Button } from "@/components/ui/button";

export function TransferButtons({
  storeCode,
  id,
  status,
  isFrom,
}: {
  storeCode: string;
  id: string;
  status: string;
  isFrom: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function act(a: "send" | "receive" | "return" | "cancel", ok: string, ask?: string) {
    if (ask && !confirm(ask)) return;
    start(async () => {
      const res = await transferAction(storeCode, id, a);
      if (!res.ok) return void toast.error(res.error);
      toast.success(ok);
      router.refresh();
    });
  }
  return (
    <div className="flex flex-wrap gap-2">
      {status === "draft" && isFrom && (
        <>
          <Button className="h-10" disabled={pending} onClick={() => act("send", "Đã gửi hàng", "Gửi hàng? Tồn cửa hàng gửi sẽ giảm ngay.")}>
            Gửi hàng
          </Button>
          <Button variant="ghost" className="h-10 text-destructive" disabled={pending} onClick={() => act("cancel", "Đã hủy phiếu", "Hủy phiếu nháp?")}>
            Hủy phiếu
          </Button>
        </>
      )}
      {status === "sent" && !isFrom && (
        <Button className="h-10" disabled={pending} onClick={() => act("receive", "Đã nhận hàng vào kho", "Xác nhận đã nhận đủ hàng?")}>
          Xác nhận đã nhận
        </Button>
      )}
      {status === "sent" && isFrom && (
        <Button
          variant="outline"
          className="h-10"
          disabled={pending}
          onClick={() => act("return", "Đã nhận lại hàng", "Hủy chuyển và nhận lại hàng về cửa hàng gửi?")}
        >
          Nhận lại (hủy chuyển)
        </Button>
      )}
    </div>
  );
}
