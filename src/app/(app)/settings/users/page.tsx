import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/roles";
import { UserManager, type UserRow } from "./user-manager";

export const metadata = { title: "Người dùng" };

export default async function UsersPage() {
  const ctx = await requireRole("sadmin", "admin");
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, username, full_name, phone, role, is_active, default_store_id, extra_permissions, user_stores(store_id)")
    .order("username");

  const users: UserRow[] = (data ?? []).map((u) => ({
    id: u.id,
    username: u.username,
    full_name: u.full_name,
    phone: u.phone,
    role: u.role as AppRole,
    is_active: u.is_active,
    default_store_id: u.default_store_id,
    confirm_receipt: Boolean((u.extra_permissions as Record<string, unknown>)?.confirm_receipt),
    store_ids: (u.user_stores as { store_id: string }[]).map((x) => x.store_id),
  }));

  return <UserManager users={users} stores={ctx.stores} myRole={ctx.profile.role} myId={ctx.profile.id} />;
}
