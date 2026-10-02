import { requireSession } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Khoi } from "@/components/khoi";
import { ChipSac } from "@/components/ui/chip";
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
    <div className="max-w-4xl space-y-4">
      <PageHeader
        title="Tài khoản"
        description={
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <ChipSac sac="slate">{ctx.profile.full_name}</ChipSac>
            <ChipSac sac="slate" className="font-mono">
              {ctx.profile.username}
            </ChipSac>
            <ChipSac sac="brand">{ROLE_LABEL[ctx.profile.role]}</ChipSac>
          </span>
        }
      />
      <div className="grid items-start gap-4 md:grid-cols-2">
        <Khoi title="Đổi mật khẩu">
          <PasswordChangeForm />
        </Khoi>
        {isManager && (
          <Khoi title="Mã PIN duyệt giảm giá" aside={<ChipSac sac={hasPin ? "emerald" : "amber"}>{hasPin ? "Đã đặt PIN" : "Chưa đặt PIN"}</ChipSac>}>
            <PinForm hasPin={hasPin} />
          </Khoi>
        )}
      </div>
    </div>
  );
}
