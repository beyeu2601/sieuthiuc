"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { errorMessage, type ActionResult } from "@/lib/errors";
import { USERNAME_RE, usernameToEmail, type AppRole } from "@/lib/roles";

/* ---------------- Cua hang ---------------- */

export type StoreInput = {
  name: string;
  address: string | null;
  phone: string | null;
  tax_code: string | null;
  invoice_header: string | null;
  invoice_footer: string | null;
};

export async function updateStore(storeId: string, input: StoreInput): Promise<ActionResult> {
  if (!input.name?.trim()) return { ok: false, error: "Nhập tên cửa hàng" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_store", { p_store_id: storeId, p: input });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

/* ---------------- Cau hinh ---------------- */

export async function saveSettings(storeId: string | null, values: Record<string, unknown>): Promise<ActionResult> {
  const supabase = await createClient();
  for (const [key, value] of Object.entries(values)) {
    const { error } = await supabase.rpc("set_setting", { p_key: key, p_store_id: storeId, p_value: value });
    if (error) return { ok: false, error: errorMessage(error) };
  }
  revalidatePath("/settings", "layout");
  return { ok: true };
}

/* ---------------- Nhom hang, thuong hieu ---------------- */

export async function saveCategory(
  id: string | null,
  input: { name: string; benefit_pct: number | null; is_active: boolean }
): Promise<ActionResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Nhập tên nhóm hàng" };
  if (input.benefit_pct != null && (input.benefit_pct < 0 || input.benefit_pct > 1000))
    return { ok: false, error: "% Benefit từ 0 đến 1000" };
  const supabase = await createClient();
  const row = { name, benefit_pct: input.benefit_pct, is_active: input.is_active };
  const { error } = id
    ? await supabase.from("categories").update(row).eq("id", id)
    : await supabase.from("categories").insert(row);
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/settings/catalog");
  return { ok: true };
}

export async function saveBrand(id: string | null, name: string): Promise<ActionResult> {
  const n = name.trim();
  if (!n) return { ok: false, error: "Nhập tên thương hiệu" };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("brands").update({ name: n }).eq("id", id)
    : await supabase.from("brands").insert({ name: n });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/settings/catalog");
  return { ok: true };
}

/* ---------------- Hang thanh vien ---------------- */

export type TierInput = {
  name: string;
  rank: number;
  min_total_spent: number;
  earn_multiplier: number;
  discount_pct: number;
};

export async function saveTier(id: string | null, input: TierInput): Promise<ActionResult> {
  if (!input.name.trim()) return { ok: false, error: "Nhập tên hạng" };
  if (input.earn_multiplier <= 0) return { ok: false, error: "Hệ số tích điểm phải lớn hơn 0" };
  if (input.discount_pct < 0 || input.discount_pct > 100) return { ok: false, error: "Giảm giá từ 0 đến 100%" };
  const supabase = await createClient();
  const row = { ...input, name: input.name.trim() };
  const { error } = id
    ? await supabase.from("member_tiers").update(row).eq("id", id)
    : await supabase.from("member_tiers").insert(row);
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/settings/loyalty");
  return { ok: true };
}

export async function deleteTier(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("member_tiers").delete().eq("id", id);
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/settings/loyalty");
  return { ok: true };
}

/* ---------------- Nguoi dung ---------------- */

export type UserInput = {
  username: string;
  full_name: string;
  phone: string | null;
  role: AppRole;
  store_ids: string[];
  default_store_id: string | null;
  is_active: boolean;
  confirm_receipt: boolean;
  password?: string;
};

// sadmin: moi thao tac. admin: chi tao/sua ke toan, nhan vien trong cua hang minh quan ly.
async function assertCanManage(role: AppRole, storeIds: string[], targetId: string | null) {
  const ctx = await requireRole("sadmin", "admin");
  if (ctx.profile.role === "sadmin") return ctx;
  const own = new Set(ctx.stores.map((s) => s.id));
  if (!["accountant", "staff"].includes(role)) throw new Error("Quản lý cửa hàng chỉ tạo được tài khoản Kế toán hoặc Nhân viên.");
  if (storeIds.some((s) => !own.has(s))) throw new Error("Chỉ gán được cửa hàng bạn đang quản lý.");
  if (targetId) {
    const admin = createAdminClient();
    const { data: target } = await admin
      .from("profiles")
      .select("role, user_stores(store_id)")
      .eq("id", targetId)
      .single();
    if (!target || !["accountant", "staff"].includes(target.role)) throw new Error("Bạn không được sửa tài khoản này.");
    const targetStores = (target.user_stores as { store_id: string }[]).map((x) => x.store_id);
    if (targetStores.some((s) => !own.has(s))) throw new Error("Tài khoản này thuộc cửa hàng bạn không quản lý.");
  }
  return ctx;
}

function validateUser(input: UserInput, isNew: boolean): string | null {
  if (!USERNAME_RE.test(input.username)) return "Tên đăng nhập 3-32 ký tự: chữ thường không dấu, số, dấu chấm, gạch dưới.";
  if (!input.full_name.trim()) return "Nhập họ tên.";
  if (input.role !== "sadmin" && input.store_ids.length === 0) return "Chọn ít nhất một cửa hàng.";
  if (isNew && (!input.password || input.password.length < 8)) return "Mật khẩu tối thiểu 8 ký tự.";
  return null;
}

export async function createUser(input: UserInput): Promise<ActionResult> {
  input = { ...input, username: input.username.trim().toLowerCase() };
  const invalid = validateUser(input, true);
  if (invalid) return { ok: false, error: invalid };
  try {
    await assertCanManage(input.role, input.store_ids, null);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const admin = createAdminClient();
  const { data: exists } = await admin.from("profiles").select("id").eq("username", input.username).maybeSingle();
  if (exists) return { ok: false, error: "Tên đăng nhập đã tồn tại." };

  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email: usernameToEmail(input.username),
    password: input.password!,
    email_confirm: true,
    user_metadata: { username: input.username, full_name: input.full_name },
  });
  if (authErr || !created.user) return { ok: false, error: "Không tạo được tài khoản đăng nhập." };

  const uid = created.user.id;
  const { error: pErr } = await admin.from("profiles").insert({
    id: uid,
    username: input.username,
    full_name: input.full_name.trim(),
    phone: input.phone?.trim() || null,
    role: input.role,
    is_active: true,
    default_store_id: input.default_store_id ?? input.store_ids[0] ?? null,
    extra_permissions: input.confirm_receipt ? { confirm_receipt: true } : {},
  });
  if (pErr) {
    await admin.auth.admin.deleteUser(uid);
    return { ok: false, error: errorMessage(pErr) };
  }
  if (input.store_ids.length) {
    const { error } = await admin.from("user_stores").insert(input.store_ids.map((s) => ({ user_id: uid, store_id: s })));
    if (error) return { ok: false, error: errorMessage(error) };
  }
  revalidatePath("/settings/users");
  return { ok: true };
}

export async function updateUser(id: string, input: UserInput): Promise<ActionResult> {
  const invalid = validateUser(input, false);
  if (invalid) return { ok: false, error: invalid };
  let ctx;
  try {
    ctx = await assertCanManage(input.role, input.store_ids, id);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (id === ctx.profile.id && (!input.is_active || input.role !== ctx.profile.role))
    return { ok: false, error: "Không tự khóa hoặc tự đổi vai trò của chính mình." };

  const admin = createAdminClient();
  const { data: current } = await admin.from("profiles").select("extra_permissions").eq("id", id).single();
  const extra = { ...((current?.extra_permissions as Record<string, unknown>) ?? {}) };
  if (input.confirm_receipt) extra.confirm_receipt = true;
  else delete extra.confirm_receipt;

  const { error } = await admin
    .from("profiles")
    .update({
      full_name: input.full_name.trim(),
      phone: input.phone?.trim() || null,
      role: input.role,
      is_active: input.is_active,
      default_store_id: input.default_store_id ?? input.store_ids[0] ?? null,
      extra_permissions: extra,
    })
    .eq("id", id);
  if (error) return { ok: false, error: errorMessage(error) };

  const { error: delErr } = await admin.from("user_stores").delete().eq("user_id", id);
  if (delErr) return { ok: false, error: errorMessage(delErr) };
  if (input.store_ids.length) {
    const { error: insErr } = await admin.from("user_stores").insert(input.store_ids.map((s) => ({ user_id: id, store_id: s })));
    if (insErr) return { ok: false, error: errorMessage(insErr) };
  }
  // khoa tai khoan: chan dang nhap va thu hoi phien dang dung
  await admin.auth.admin.updateUserById(id, { ban_duration: input.is_active ? "none" : "876000h" });
  revalidatePath("/settings/users");
  return { ok: true };
}

export async function resetUserPassword(id: string, role: AppRole, storeIds: string[], password: string): Promise<ActionResult> {
  if (password.length < 8) return { ok: false, error: "Mật khẩu tối thiểu 8 ký tự." };
  try {
    await assertCanManage(role, storeIds, id);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, { password });
  if (error) return { ok: false, error: "Không đổi được mật khẩu." };
  return { ok: true };
}
