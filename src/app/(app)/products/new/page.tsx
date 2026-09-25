import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { ProductForm } from "../product-form";
import { getNumberSetting } from "@/lib/settings";

export const metadata = { title: "Thêm sản phẩm" };

export default async function NewProductPage() {
  await requireRole("sadmin", "admin");
  const supabase = await createClient();
  const [{ data: categories }, { data: brands }, roundingUnit] = await Promise.all([
    supabase.from("categories").select("id, name, benefit_pct").eq("is_active", true).order("name"),
    supabase.from("brands").select("id, name").order("name"),
    getNumberSetting("pricing.rounding_unit", 1000),
  ]);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Thêm sản phẩm" description="SKU tự sinh. Mỗi loại hàng Cont/Air là một mã sản phẩm riêng." />
      <div className="rounded-xl border bg-card p-4">
        <ProductForm
          id={null}
          readOnly={false}
          costPriceRef={0}
          roundingUnit={roundingUnit}
          categories={categories ?? []}
          brands={brands ?? []}
          initial={{
            name: "",
            goods_type: "cont",
            unit: "",
            category_id: null,
            brand_id: null,
            pricing_method: "manual",
            sell_price: 0,
            benefit_pct: null,
            expiry_level: "lot",
            expiry_date: null,
            min_stock: null,
            max_stock: null,
            status: "active",
            note: null,
            barcode: null,
          }}
        />
      </div>
    </div>
  );
}
