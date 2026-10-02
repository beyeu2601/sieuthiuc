import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AccountEditor, type AccountRow } from "./account-editor";

export const metadata = { title: "Tài khoản tiền" };

export default async function AccountsSettingsPage() {
  const ctx = await requireRole("sadmin", "admin");
  const supabase = await createClient();
  const [{ data: balances }, { data: holders }, { data: users }] = await Promise.all([
    supabase.rpc("money_account_balances"),
    supabase.from("money_accounts").select("id, holder_id"),
    supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name"),
  ]);
  const holderOf = new Map((holders ?? []).map((h) => [h.id, h.holder_id as string | null]));
  const rows: AccountRow[] = ((balances ?? []) as Omit<AccountRow, "holder_id">[]).map((r) => ({
    ...r,
    holder_id: holderOf.get(r.id) ?? null,
  }));
  const isSadmin = ctx.profile.role === "sadmin";
  return (
    <section className="max-w-5xl space-y-3">
      <div>
        <h2
          className="font-medium"
          title="Người giữ quỹ duyệt mọi khoản thu chi của tài khoản mình; tài khoản chưa có người giữ thì quản lý cửa hàng duyệt. Số dư hiện tại = số dư đầu kỳ + thu bán hàng + thu khác đã duyệt - chi đã duyệt - trả nhà cung cấp."
        >
          Tài khoản giữ tiền
        </h2>
        {!isSadmin && <p className="text-xs text-muted-foreground">Bạn chọn được người giữ quỹ. Thêm hoặc sửa tài khoản do quản trị hệ thống làm.</p>}
      </div>
      <AccountEditor rows={rows} users={users ?? []} isSadmin={isSadmin} storeCode={ctx.stores[0]?.code ?? null} />
    </section>
  );
}
