import type { Metadata } from "next";
import Image from "next/image";
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
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(420px,520px)]">
      {/* May tinh: mang thuong hieu ben trai */}
      <section className="relative hidden overflow-hidden bg-brand lg:flex lg:flex-col lg:items-center lg:justify-center" aria-hidden>
        <div className="absolute -top-32 -left-32 size-[28rem] rounded-full bg-white/5" />
        <div className="absolute -right-24 -bottom-40 size-[34rem] rounded-full bg-white/5" />
        <Image src="/brand/logo-white.png" alt="" width={420} height={382} priority className="relative h-auto w-[min(420px,60%)]" />
        <p className="relative mt-8 text-lg text-white/85">Quản lý bán hàng, kho, công nợ và lãi lỗ cửa hàng</p>
      </section>

      <section className="flex flex-col items-center justify-center bg-card px-6 py-10">
        <div className="w-full max-w-sm">
          <Image
            src="/brand/logo.png"
            alt="Siêu Thị Úc"
            width={220}
            height={200}
            priority
            className="mx-auto mb-6 h-auto w-44 lg:hidden"
          />
          <h1 className="font-heading text-4xl font-bold tracking-wide">Đăng nhập</h1>
          <p className="mt-1 mb-7 text-muted-foreground">Dùng tên đăng nhập quản lý cấp cho bạn.</p>
          <LoginForm notice={notice} />
        </div>
      </section>
    </main>
  );
}
