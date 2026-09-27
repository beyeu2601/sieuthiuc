import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AccountEditor } from "./account-editor";

export const metadata = { title: "Tài khoản tiền" };

export default async function AccountsSettingsPage() {
  await requireRole("sadmin");
  const supabase = await createClient();
  const { data } = await supabase.rpc("money_account_balances");
  const rows = (data ?? []) as {
    id: string;
    name: string;
    kind: "cash" | "bank" | "ewallet" | "other";
    is_active: boolean;
    opening_balance: number;
    balance: number;
  }[];
  return (
    <section className="max-w-2xl rounded-xl border bg-card p-4">
      <h2 className="mb-1 font-medium">Tài khoản giữ tiền</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Nơi giữ tiền của cửa hàng (két tiền mặt, tài khoản ngân hàng, ví). Mỗi khoản thu chi, thu bán hàng và trả nhà cung cấp chọn đúng tài khoản để theo dõi số dư.
      </p>
      <AccountEditor rows={rows} />
    </section>
  );
}
