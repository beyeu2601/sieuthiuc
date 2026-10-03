import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayVN } from "@/lib/dates";
import { PageHeader } from "@/components/page-header";
import { CashForm } from "./cash-form";

export const metadata = { title: "Xin chi / báo thu" };

export default async function NewCashPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: code } = await params;
  const { ctx, store } = await requireStore(code);
  const supabase = await createClient();
  const [{ data: cats }, { data: shift }, { data: accounts }] = await Promise.all([
    supabase.from("expense_categories").select("id, name, kind").eq("is_active", true).order("name"),
    supabase.from("shifts").select("id, code").eq("store_id", store.id).eq("status", "open").maybeSingle(),
    supabase.from("money_accounts").select("id, name, kind").eq("is_active", true).order("sort_order").order("name"),
  ]);
  const isStaff = ctx.profile.role === "staff";

  return (
    <div className="max-w-5xl">
      <PageHeader title="Xin chi / báo thu" back={{ href: `/${store.code}/cash`, label: "Danh sách thu chi" }} />
      <CashForm
        storeId={store.id}
        storeCode={store.code}
        categories={(cats ?? []) as { id: string; name: string; kind: "income" | "expense" }[]}
        accounts={(accounts ?? []) as { id: string; name: string; kind: string }[]}
        isStaff={isStaff}
        openShiftCode={shift?.code ?? null}
        today={todayVN()}
      />
    </div>
  );
}
