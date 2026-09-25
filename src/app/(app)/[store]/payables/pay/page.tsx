import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayVN } from "@/lib/dates";
import { PageHeader } from "@/components/page-header";
import { PaymentForm, type OpenDebt } from "./payment-form";

export const metadata = { title: "Ghi thanh toán công nợ" };

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ store: string }>;
  searchParams: Promise<{ supplier?: string }>;
}) {
  const { store: code } = await params;
  const { supplier } = await searchParams;
  const { store } = await requireStore(code, "sadmin", "admin", "accountant");
  const supabase = await createClient();
  const { data } = await supabase
    .from("supplier_debts")
    .select("id, code, supplier_id, issued_date, due_date, remaining, suppliers(name)")
    .eq("store_id", store.id)
    .gt("remaining", 0)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("issued_date");
  const debts: OpenDebt[] = (data ?? []).map((d) => ({
    id: d.id,
    code: d.code,
    supplier_id: d.supplier_id,
    supplier_name: (d.suppliers as unknown as { name: string } | null)?.name ?? "?",
    issued_date: d.issued_date,
    due_date: d.due_date,
    remaining: d.remaining,
  }));

  return (
    <div className="max-w-3xl">
      <PageHeader title="Ghi thanh toán công nợ" description="Một lần trả có thể phân bổ cho nhiều khoản nợ, mặc định trả khoản cũ nhất trước." />
      <PaymentForm storeId={store.id} storeCode={store.code} debts={debts} initialSupplier={supplier ?? ""} today={todayVN()} />
    </div>
  );
}
