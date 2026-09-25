import { requireSession } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { PasswordChangeForm } from "./password-form";
import { PinForm } from "./pin-form";

export const metadata = { title: "Tài khoản" };

export default async function AccountPage() {
  const ctx = await requireSession();
  const isManager = ctx.profile.role === "sadmin" || ctx.profile.role === "admin";
  let hasPin = false;
  if (isManager) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("my_pin_is_set");
    hasPin = data === true;
  }
  return (
    <div className="max-w-md space-y-4">
      <PageHeader title="Tài khoản" description={`${ctx.profile.full_name} - ${ctx.profile.username} - ${ROLE_LABEL[ctx.profile.role]}`} />
      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 font-medium">Đổi mật khẩu</h2>
        <PasswordChangeForm />
      </section>
      {isManager && (
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 font-medium">Mã PIN duyệt giảm giá</h2>
          <PinForm hasPin={hasPin} />
        </section>
      )}
    </div>
  );
}
