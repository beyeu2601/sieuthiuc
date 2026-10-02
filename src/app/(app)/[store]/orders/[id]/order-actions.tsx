"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeOrderStatus, returnOrder, reviewReturn } from "../actions";
import { baoTheoKetQua } from "@/lib/feedback";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";

export function OrderActions({
  storeCode,
  id,
  status,
  paidOut,
  returnStatus,
  isManager,
}: {
  storeCode: string;
  id: string;
  status: string;
  paidOut: boolean;
  returnStatus: string | null;
  isManager: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { confirm, dialog } = useConfirm();
  async function go(to: "shipped" | "delivered" | "cancelled", ok: string) {
    let note: string | null = null;
    if (to === "cancelled") {
      note = prompt("Lý do hủy đơn?");
      if (!note?.trim()) return;
    } else if (
      to === "delivered" &&
      !(await confirm({
        title: "Khách đã nhận hàng?",
        description: "Hệ thống sẽ ghi doanh thu và trừ kho.",
      }))
    ) {
      return;
    }
    start(async () => {
      const res = await changeOrderStatus(storeCode, id, to, note);
      if (baoTheoKetQua(res, ok)) router.refresh();
    });
  }
  function markReturned() {
    const reason = prompt("Lý do hoàn hàng?");
    if (!reason?.trim()) return;
    start(async () => {
      const res = await returnOrder(storeCode, id, reason);
      if (baoTheoKetQua(res, "Đã ghi hoàn hàng, bỏ doanh thu. Chờ quản lý kiểm hàng.")) router.refresh();
    });
  }
  async function review(restock: boolean) {
    let note: string | null = null;
    if (restock) {
      if (!(await confirm({ title: "Nhập lại kho hàng hoàn?", description: "Hàng được trả về đúng lô đã xuất khi giao." }))) return;
    } else {
      note = prompt("Lý do không nhập lại kho (hàng hỏng, thiếu...)?");
      if (!note?.trim()) return;
    }
    start(async () => {
      const res = await reviewReturn(storeCode, id, restock, note);
      if (baoTheoKetQua(res, restock ? "Đã nhập lại kho" : "Đã ghi không nhập kho")) router.refresh();
    });
  }

  if (status === "delivered" && !paidOut) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button className="h-10" variant="outline" disabled={pending} onClick={markReturned}>
          Hoàn hàng
        </Button>
      </div>
    );
  }
  if (status === "returned" && returnStatus === "pending_check" && isManager) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button className="h-10" disabled={pending} onClick={() => review(true)}>
          Kiểm xong, nhập lại kho
        </Button>
        <Button className="h-10" variant="outline" disabled={pending} onClick={() => review(false)}>
          Không nhập kho
        </Button>
        {dialog}
      </div>
    );
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
      {dialog}
    </div>
  );
}
