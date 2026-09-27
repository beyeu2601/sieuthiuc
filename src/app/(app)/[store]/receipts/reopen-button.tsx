"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { reopenReceipt } from "./actions";
import { Button } from "@/components/ui/button";

// Nut mo lai phieu da xac nhan ve nhap de sua (SL/gia/HSD), sau do xac nhan lai.
export function ReopenButton({ storeCode, receiptId }: { storeCode: string; receiptId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => {
        if (
          !confirm(
            "Mở lại phiếu để sửa?\n\nTồn kho và công nợ của phiếu sẽ được đảo lại, phiếu quay về trạng thái nháp để bạn sửa số lượng/giá/HSD rồi xác nhận lại. Chỉ làm được khi hàng của phiếu chưa bán/chuyển và chưa thanh toán."
          )
        )
          return;
        start(async () => {
          const res = await reopenReceipt(storeCode, receiptId);
          if (!res.ok) return void toast.error(res.error);
          toast.success("Đã mở lại phiếu để sửa");
          router.refresh();
        });
      }}
    >
      {pending ? "Đang mở lại..." : "Sửa phiếu"}
    </Button>
  );
}
