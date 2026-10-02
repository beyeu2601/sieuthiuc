"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setAccountHolder } from "../../actions";
import { LuaChon } from "@/components/lua-chon";
import { Button } from "@/components/ui/button";

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
    <div className="space-y-2">
      <LuaChon
        id="holder"
        aria-label="Người giữ tài khoản"
        value={value}
        onChange={setValue}
        disabled={pending}
        options={[{ value: "", label: "Chưa có" }, ...users.map((u) => ({ value: u.id, label: u.full_name }))]}
      />
      <Button
        className="h-10 w-full"
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
        {pending ? "Đang lưu..." : "Lưu người giữ"}
      </Button>
    </div>
  );
}
