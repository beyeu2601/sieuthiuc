import Link from "next/link";
import { logout } from "@/app/login/actions";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Không có quyền" };

export default async function ForbiddenPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const message =
    reason === "no-store"
      ? "Tài khoản của bạn chưa được gán cửa hàng nào. Liên hệ quản lý để được cấp quyền."
      : "Bạn không có quyền truy cập trang này.";

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="max-w-sm space-y-4 text-center">
        <h1 className="text-xl font-semibold">Không có quyền truy cập</h1>
        <p className="text-muted-foreground">{message}</p>
        <div className="flex justify-center gap-2">
          {reason !== "no-store" && (
            <Button variant="outline" render={<Link href="/" />}>
              Về trang chính
            </Button>
          )}
          <form action={logout}>
            <Button type="submit" variant="ghost">
              Đăng xuất
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
