import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

import type { AppRole, StoreLite } from "@/lib/roles";

export { ROLE_LABEL, USERNAME_RE, usernameToEmail } from "@/lib/roles";
export type { AppRole, StoreLite } from "@/lib/roles";

export type Profile = {
  id: string;
  username: string;
  full_name: string;
  role: AppRole;
  is_active: boolean;
  default_store_id: string | null;
  extra_permissions: Record<string, unknown>;
};

export type SessionContext = { profile: Profile; stores: StoreLite[] };

// Doc ho so + danh sach cua hang duoc truy cap (RLS loc). Dung chung trong 1 request.
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, full_name, role, is_active, default_store_id, extra_permissions")
    .eq("id", user.id)
    .maybeSingle<Profile>();
  if (!profile || !profile.is_active) return null;

  const { data: stores } = await supabase
    .from("stores")
    .select("id, code, name")
    .eq("is_active", true)
    .order("code")
    .returns<StoreLite[]>();

  return { profile, stores: stores ?? [] };
});

export async function requireSession(): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login?reason=inactive");
  return ctx;
}

export async function requireRole(...roles: AppRole[]): Promise<SessionContext> {
  const ctx = await requireSession();
  if (!roles.includes(ctx.profile.role)) redirect("/forbidden");
  return ctx;
}

export function homeStoreCode(ctx: SessionContext): string | null {
  const byDefault = ctx.stores.find((s) => s.id === ctx.profile.default_store_id);
  return (byDefault ?? ctx.stores[0])?.code ?? null;
}

// Cua hang dang mo theo ma tren URL (layout [store] da chan ma khong hop le).
export async function requireStore(code: string, ...roles: AppRole[]) {
  const ctx = roles.length ? await requireRole(...roles) : await requireSession();
  const store = ctx.stores.find((s) => s.code === code);
  if (!store) redirect("/forbidden");
  return { ctx, store };
}

export function hasPerm(ctx: SessionContext, perm: string) {
  return ctx.profile.extra_permissions?.[perm] === true;
}
