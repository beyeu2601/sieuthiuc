"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelPayout } from "../../actions";
import { baoTheoKetQua } from "@/lib/feedback";
import { Button } from "@/components/ui/button";

export function CancelPayoutButton({ storeCode, id }: { storeCode: string; id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function go() {
    const reason = prompt("Lý do hủy đợt đối soát? Các đơn sẽ trở về chờ Shopee trả, khoản phí sàn bị xóa.");
    if (!reason?.trim()) return;
    start(async () => {
      const res = await cancelPayout(storeCode, id, reason);
      if (baoTheoKetQua(res, "Đã hủy đợt đối soát")) router.refresh();
    });
  }
  return (
    <Button variant="outline" disabled={pending} onClick={go}>
      Hủy đợt
    </Button>
  );
}
