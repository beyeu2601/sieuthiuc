"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { deleteProduct } from "../actions";

export function DeleteProduct({ productId, productName }: { productId: string; productName: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { confirm, dialog } = useConfirm();

  async function onDelete() {
    const ok = await confirm({
      title: "Xóa sản phẩm?",
      description: `${productName}\nChỉ xóa được khi chưa có giao dịch và đã hết tồn. Không hoàn tác được.`,
      confirmLabel: "Xóa sản phẩm",
      danger: true,
    });
    if (!ok) return;
    start(async () => {
      const res = await deleteProduct(productId);
      if (res.ok) {
        toast.success("Đã xóa sản phẩm");
        router.push("/products");
      } else toast.error(res.error);
    });
  }

  return (
    <>
      <Button type="button" variant="destructive" className="h-10" disabled={pending} onClick={onDelete}>
        Xóa sản phẩm
      </Button>
      {dialog}
    </>
  );
}
