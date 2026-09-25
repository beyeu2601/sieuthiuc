import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StoreForm } from "./store-form";

export const metadata = { title: "Cài đặt cửa hàng" };

export default async function SettingsStorePage() {
  const ctx = await requireRole("sadmin", "admin");
  const supabase = await createClient();
  const { data: stores } = await supabase
    .from("stores")
    .select("id, code, name, address, phone, tax_code, invoice_header, invoice_footer")
    .in("id", ctx.stores.map((s) => s.id))
    .order("code");

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Thông tin cửa hàng in trên hóa đơn. Mã cửa hàng dùng trong đường dẫn và mã chứng từ, không đổi được ở đây.
      </p>
      {(stores ?? []).map((s) => (
        <section key={s.id} className="max-w-3xl rounded-xl border bg-card p-4">
          <h2 className="mb-3 font-medium">
            {s.code} - {s.name}
          </h2>
          <StoreForm
            storeId={s.id}
            initial={{
              name: s.name,
              address: s.address,
              phone: s.phone,
              tax_code: s.tax_code,
              invoice_header: s.invoice_header,
              invoice_footer: s.invoice_footer,
            }}
          />
        </section>
      ))}
    </div>
  );
}
