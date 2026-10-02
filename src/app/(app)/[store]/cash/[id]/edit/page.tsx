import { notFound } from "next/navigation";
import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayVN } from "@/lib/dates";
import { PageHeader } from "@/components/page-header";
import { CashForm } from "../../new/cash-form";
import type { CashPayload } from "../../actions";

export const metadata = { title: "Sửa khoản thu chi" };

export default async function EditCashPage({ params }: { params: Promise<{ store: string; id: string }> }) {
  const { store: code, id } = await params;
  const { ctx, store } = await requireStore(code);
  const supabase = await createClient();
  const [{ data: t }, { data: cats }, { data: accounts }] = await Promise.all([
    supabase
      .from("cash_transactions")
      .select("id, code, kind, category_id, occurred_on, description, amount, method, counterparty, doc_no, note, account_id")
      .eq("id", id)
      .eq("store_id", store.id)
      .maybeSingle(),
    supabase.from("expense_categories").select("id, name, kind").eq("is_active", true).order("name"),
    supabase.from("money_accounts").select("id, name, kind").eq("is_active", true).order("sort_order").order("name"),
  ]);
  if (!t) notFound();

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={`Sửa ${t.code}`}
        back={{ href: `/${store.code}/cash`, label: "Danh sách thu chi" }}
        description="Thay đổi chỉ áp dụng khi người giữ tài khoản duyệt. Trong lúc chờ, khoản này giữ nguyên số cũ."
      />
      <CashForm
        storeId={store.id}
        storeCode={store.code}
        categories={(cats ?? []) as { id: string; name: string; kind: "income" | "expense" }[]}
        accounts={(accounts ?? []) as { id: string; name: string; kind: string }[]}
        isStaff={ctx.profile.role === "staff"}
        openShiftCode={null}
        today={todayVN()}
        edit={{
          id: t.id,
          initial: {
            kind: t.kind as CashPayload["kind"],
            category_id: t.category_id,
            occurred_on: t.occurred_on,
            description: t.description,
            amount: t.amount,
            method: t.method as CashPayload["method"],
            counterparty: t.counterparty,
            doc_no: t.doc_no,
            note: t.note,
            account_id: t.account_id,
          },
        }}
      />
    </div>
  );
}
