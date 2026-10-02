"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setAccountHolder } from "../../actions";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function HolderSelect({
  storeCode,
  accountId,
  holderId,
  users,
}: {
  storeCode: string;
  accountId: string;
  holderId: string | null;
  users: { id: string; full_name: string }[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(holderId ?? "");
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-56 space-y-1.5">
        <Label htmlFor="holder">Người giữ tài khoản</Label>
        <NativeSelect id="holder" value={value} onChange={(e) => setValue(e.target.value)}>
          <option value="">Chưa có (quản lý cửa hàng duyệt)</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name}
            </option>
          ))}
        </NativeSelect>
      </div>
      <Button
        className="h-11"
        disabled={pending || value === (holderId ?? "")}
        onClick={() =>
          start(async () => {
            const res = await setAccountHolder(storeCode, accountId, value || null);
            if (!res.ok) return void toast.error(res.error);
            toast.success("Đã lưu người giữ tài khoản");
            router.refresh();
          })
        }
      >
        Lưu
      </Button>
    </div>
  );
}
