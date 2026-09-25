import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Đăng nhập" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  if (await getSessionContext()) redirect("/");
  const { reason } = await searchParams;
  const notice =
    reason === "inactive" ? "Tài khoản đã bị khóa hoặc chưa được cấp quyền. Liên hệ quản lý." : undefined;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-background p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Siêu Thị Úc</h1>
        <p className="mb-6 text-sm text-muted-foreground">Đăng nhập để tiếp tục</p>
        <LoginForm notice={notice} />
      </div>
    </main>
  );
}
