"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setMyPin } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PinForm({ hasPin }: { hasPin: boolean }) {
  const [pin, setPin] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await setMyPin(pin);
          if (!res.ok) return void toast.error(res.error);
          setPin("");
          toast.success("Đã lưu mã PIN");
        });
      }}
      className="space-y-3"
    >
      <p className="text-sm text-muted-foreground">
        Dùng khi nhân viên giảm giá vượt hạn mức tại quầy: bạn nhập tên đăng nhập và PIN trên máy bán hàng.
        {hasPin ? " Bạn đã có PIN, nhập PIN mới để đổi." : " Bạn chưa đặt PIN."}
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="pin">Mã PIN (4-8 chữ số)</Label>
        <Input
          id="pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
          className="w-40"
        />
      </div>
      <Button type="submit" disabled={pending || pin.length < 4}>
        Lưu PIN
      </Button>
    </form>
  );
}
