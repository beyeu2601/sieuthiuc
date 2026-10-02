import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ChipSac } from "@/components/ui/chip";
import { Khoi } from "@/components/khoi";
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
      {(stores ?? []).map((s) => (
        <Khoi
          key={s.id}
          title={s.name}
          className="max-w-5xl"
          aside={
            <ChipSac sac="slate" className="font-mono" title="Mã cửa hàng dùng trong đường dẫn và mã chứng từ, không đổi được ở đây">
              {s.code}
            </ChipSac>
          }
        >
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
        </Khoi>
      ))}
    </div>
  );
}
