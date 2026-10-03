"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { deleteOrder } from "../actions";

export function DeleteOrder({ storeCode, id, code }: { storeCode: string; id: string; code: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { confirm, dialog } = useConfirm();

  async function onDelete() {
    const ok = await confirm({
      title: "Xóa đơn?",
      description: `${code}\nĐơn, giao dịch bán đã hủy và lịch sử giữ/xuất/nhập lại kho của đơn sẽ bị xóa. Tồn kho không đổi. Không hoàn tác được.`,
      confirmLabel: "Xóa đơn",
      danger: true,
    });
    if (!ok) return;
    start(async () => {
      const res = await deleteOrder(storeCode, id);
      if (res.ok) {
        toast.success(`Đã xóa đơn ${code}`);
        router.push(`/${storeCode}/orders`);
      } else toast.error(res.error);
    });
  }

  return (
    <>
      <Button type="button" variant="destructive" className="h-10" disabled={pending} onClick={onDelete}>
        Xóa đơn
      </Button>
      {dialog}
    </>
  );
}
