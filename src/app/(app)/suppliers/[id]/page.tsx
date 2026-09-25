import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { SupplierForm } from "../supplier-form";

export default async function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole("sadmin", "admin", "accountant");
  const supabase = await createClient();
  const { data: s } = await supabase
    .from("suppliers")
    .select(
      "id, code, name, contact_name, phone, email, address, tax_code, bank_name, bank_account, payment_terms_days, note, is_active"
    )
    .eq("id", id)
    .maybeSingle();
  if (!s) notFound();
  const { id: supplierId, code, ...initial } = s;

  return (
    <div className="max-w-3xl">
      <PageHeader title={s.name} description={code} />
      <div className="rounded-xl border bg-background p-4">
        <SupplierForm id={supplierId} readOnly={false} initial={initial} />
      </div>
    </div>
  );
}
