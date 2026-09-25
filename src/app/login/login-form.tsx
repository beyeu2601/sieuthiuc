"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: LoginState = { error: null, username: "" };

export function LoginForm({ notice }: { notice?: string }) {
  const [state, action, pending] = useActionState(login, initial);

  return (
    <form action={action} className="space-y-4" noValidate>
      {notice && !state.error && (
        <p role="status" className="rounded-lg bg-muted px-3 py-2 text-sm">
          {notice}
        </p>
      )}
      {state.error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="username">Tên đăng nhập</Label>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          defaultValue={state.username}
          className="h-12 text-base"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Mật khẩu</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-12 text-base"
        />
      </div>
      <Button type="submit" className="h-12 w-full text-base" disabled={pending}>
        {pending ? "Đang đăng nhập..." : "Đăng nhập"}
      </Button>
    </form>
  );
}
