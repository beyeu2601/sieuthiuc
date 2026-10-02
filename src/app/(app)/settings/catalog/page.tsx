import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Khoi } from "@/components/khoi";
import { CategoryEditor, BrandEditor } from "./editors";

export const metadata = { title: "Nhóm hàng & thương hiệu" };

export default async function CatalogSettingsPage() {
  await requireRole("sadmin", "admin");
  const supabase = await createClient();
  const [{ data: categories }, { data: brands }] = await Promise.all([
    supabase.from("categories").select("id, name, is_active, description").order("name"),
    supabase.from("brands").select("id, name").order("name"),
  ]);
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Khoi title="Nhóm hàng" aside={<span className="text-xs text-muted-foreground tabular-nums">{(categories ?? []).length}</span>}>
        <CategoryEditor rows={categories ?? []} />
      </Khoi>
      <Khoi title="Thương hiệu" aside={<span className="text-xs text-muted-foreground tabular-nums">{(brands ?? []).length}</span>}>
        <BrandEditor rows={brands ?? []} />
      </Khoi>
    </div>
  );
}
