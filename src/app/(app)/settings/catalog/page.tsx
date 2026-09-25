import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CategoryEditor, BrandEditor } from "./editors";

export const metadata = { title: "Nhóm hàng & thương hiệu" };

export default async function CatalogSettingsPage() {
  await requireRole("sadmin", "admin");
  const supabase = await createClient();
  const [{ data: categories }, { data: brands }] = await Promise.all([
    supabase.from("categories").select("id, name, benefit_pct, is_active").order("name"),
    supabase.from("brands").select("id, name").order("name"),
  ]);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border bg-background p-4">
        <h2 className="mb-1 font-medium">Nhóm hàng</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          % Benefit của nhóm áp dụng cho sản phẩm đặt giá theo % Benefit mà không có % riêng.
        </p>
        <CategoryEditor rows={categories ?? []} />
      </section>
      <section className="rounded-xl border bg-background p-4">
        <h2 className="mb-3 font-medium">Thương hiệu</h2>
        <BrandEditor rows={brands ?? []} />
      </section>
    </div>
  );
}
