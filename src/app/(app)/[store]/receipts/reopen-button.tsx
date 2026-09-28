"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { reopenReceipt } from "./actions";
import { baoTheoKetQua } from "@/lib/feedback";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";

// Nut mo lai phieu da xac nhan ve nhap de sua (SL/gia/HSD), sau do xac nhan lai.
export function ReopenButton({ storeCode, receiptId }: { storeCode: string; receiptId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { confirm, dialog } = useConfirm();
  return (
    <>
      {dialog}
      <Button
      variant="outline"
      disabled={pending}
      onClick={async () => {
        if (
          !(await confirm({
            title: "Mở lại phiếu để sửa?",
            description:
              "Tồn kho và công nợ của phiếu sẽ được đảo lại, phiếu quay về trạng thái nháp để bạn sửa số lượng/giá/HSD rồi xác nhận lại. Chỉ làm được khi hàng của phiếu chưa bán/chuyển và chưa thanh toán.",
          }))
        )
          return;
        start(async () => {
          const res = await reopenReceipt(storeCode, receiptId);
          if (baoTheoKetQua(res, "Đã mở lại phiếu để sửa")) router.refresh();
        });
      }}
    >
      {pending ? "Đang mở lại..." : "Sửa phiếu"}
      </Button>
    </>
  );
}
