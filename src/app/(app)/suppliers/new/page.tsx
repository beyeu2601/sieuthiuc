import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { SupplierForm } from "../supplier-form";

export const metadata = { title: "Thêm nhà cung cấp" };

export default async function NewSupplierPage() {
  await requireRole("sadmin", "admin", "accountant");
  return (
    <div className="max-w-3xl">
      <PageHeader title="Thêm nhà cung cấp" description="Mã nhà cung cấp tự sinh." />
      <div className="rounded-xl border bg-background p-4">
        <SupplierForm
          id={null}
          readOnly={false}
          initial={{
            name: "",
            contact_name: null,
            phone: null,
            email: null,
            address: null,
            tax_code: null,
            bank_name: null,
            bank_account: null,
            payment_terms_days: 0,
            note: null,
            is_active: true,
          }}
        />
      </div>
    </div>
  );
}
