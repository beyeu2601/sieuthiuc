"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { changeOrderStatus } from "../actions";
import { Button } from "@/components/ui/button";

export function OrderActions({ storeCode, id, status }: { storeCode: string; id: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function go(to: "shipped" | "delivered" | "cancelled", ok: string) {
    let note: string | null = null;
    if (to === "cancelled") {
      note = prompt("Lý do hủy đơn?");
      if (!note?.trim()) return;
    } else if (to === "delivered" && !confirm("Xác nhận khách đã nhận hàng? Hệ thống sẽ ghi doanh thu và trừ kho.")) {
      return;
    }
    start(async () => {
      const res = await changeOrderStatus(storeCode, id, to, note);
      if (!res.ok) return void toast.error(res.error);
      toast.success(ok);
      router.refresh();
    });
  }
  if (status !== "pending" && status !== "shipped") return null;
  return (
    <div className="flex flex-wrap gap-2">
      {status === "pending" && (
        <Button className="h-10" variant="outline" disabled={pending} onClick={() => go("shipped", "Đã chuyển sang đang giao")}>
          Đã gửi hàng
        </Button>
      )}
      <Button className="h-10" disabled={pending} onClick={() => go("delivered", "Đã giao thành công, ghi nhận doanh thu")}>
        Giao thành công
      </Button>
      <Button className="h-10" variant="ghost" disabled={pending} onClick={() => go("cancelled", "Đã hủy đơn, trả hàng về khả dụng")}>
        Hủy đơn
      </Button>
    </div>
  );
}
