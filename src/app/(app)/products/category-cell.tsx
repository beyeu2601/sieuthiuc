"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bulkUpdateProducts } from "./actions";
import { baoTheoKetQua } from "@/lib/feedback";
import { LuaChon } from "@/components/lua-chon";

// Doi nhom hang ngay tren danh sach (khach yeu cau 02/10/2026: nhieu san pham sai nhom).
export function CategoryCell({
  productId,
  productName,
  categoryId,
  categories,
}: {
  productId: string;
  productName: string;
  categoryId: string | null;
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(categoryId ?? "");
  const [pending, start] = useTransition();

  function change(next: string) {
    const prev = value;
    setValue(next);
    start(async () => {
      const res = await bulkUpdateProducts([productId], { category_id: next });
      const name = categories.find((c) => c.id === next)?.name;
      if (baoTheoKetQua(res, `Đã chuyển sang nhóm "${name}"`)) router.refresh();
      else setValue(prev);
    });
  }

  return (
    <LuaChon
      value={value}
      onChange={change}
      disabled={pending}
      aria-label={`Nhóm hàng của ${productName}`}
      className="mt-1 h-8 w-auto max-w-56 px-2 text-xs text-muted-foreground"
      options={[
        ...(!value ? [{ value: "", label: "Chưa có nhóm hàng", disabled: true }] : []),
        ...categories.map((c) => ({ value: c.id, label: c.name })),
      ]}
    />
  );
}
