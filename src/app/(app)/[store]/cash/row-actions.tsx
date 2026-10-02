"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { markCashPaid, requestCashChange, reviewCash } from "./actions";
import { todayVN } from "@/lib/dates";
import { Button } from "@/components/ui/button";

export function CashRowActions({
  storeCode,
  id,
  canReview,
  canMarkPaid,
  canRequest,
}: {
  storeCode: string;
  id: string;
  canReview: boolean;
  canMarkPaid: boolean;
  canRequest: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function run(fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) {
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      toast.success(ok);
      router.refresh();
    });
  }
  return (
    <div className="flex justify-end gap-1 whitespace-nowrap">
      {canReview && (
        <>
          <Button size="sm" disabled={pending} onClick={() => run(() => reviewCash(storeCode, id, true, null), "Đã duyệt")}>
            Duyệt
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              const reason = prompt("Lý do từ chối?");
              if (reason?.trim()) run(() => reviewCash(storeCode, id, false, reason), "Đã từ chối");
            }}
          >
            Từ chối
          </Button>
        </>
      )}
      {canMarkPaid && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => markCashPaid(storeCode, id, todayVN()), "Đã đánh dấu đã trả")}>
          Đã trả
        </Button>
      )}
      {canRequest && (
        <>
          <Button size="sm" variant="ghost" disabled={pending} render={<Link href={`/${storeCode}/cash/${id}/edit`} />}>
            Sửa
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              const reason = prompt("Lý do xóa khoản này?");
              if (!reason?.trim()) return;
              start(async () => {
                const res = await requestCashChange(storeCode, id, "delete", null, reason);
                if (!res.ok) return void toast.error(res.error);
                toast.success(res.data!.applied ? "Đã xóa" : "Đã gửi yêu cầu xóa, chờ người giữ tài khoản duyệt");
                router.refresh();
              });
            }}
          >
            Xóa
          </Button>
        </>
      )}
    </div>
  );
}
