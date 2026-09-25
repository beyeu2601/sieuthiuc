import { requireSession } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/roles";
import { PageHeader } from "@/components/page-header";
import { PasswordChangeForm } from "./password-form";

export const metadata = { title: "Tài khoản" };

export default async function AccountPage() {
  const ctx = await requireSession();
  return (
    <div className="max-w-md">
      <PageHeader title="Tài khoản" description={`${ctx.profile.full_name} - ${ctx.profile.username} - ${ROLE_LABEL[ctx.profile.role]}`} />
      <section className="rounded-xl border bg-background p-4">
        <h2 className="mb-3 font-medium">Đổi mật khẩu</h2>
        <PasswordChangeForm />
      </section>
    </div>
  );
}
