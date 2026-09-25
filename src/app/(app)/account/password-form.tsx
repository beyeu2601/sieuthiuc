"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordChangeForm() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw.length < 8) return setError("Mật khẩu tối thiểu 8 ký tự.");
    if (pw !== pw2) return setError("Hai lần nhập không khớp.");
    start(async () => {
      const { error } = await createClient().auth.updateUser({ password: pw });
      if (error) return setError("Không đổi được mật khẩu. Thử mật khẩu khác.");
      setPw("");
      setPw2("");
      toast.success("Đã đổi mật khẩu");
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="pw">Mật khẩu mới</Label>
        <Input id="pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pw2">Nhập lại mật khẩu mới</Label>
        <Input id="pw2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
      </div>
      <Button type="submit" disabled={pending} className="h-10">
        {pending ? "Đang lưu..." : "Đổi mật khẩu"}
      </Button>
    </form>
  );
}
