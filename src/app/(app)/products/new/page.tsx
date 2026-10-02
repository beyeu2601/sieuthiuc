import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Khoi } from "@/components/khoi";
import { ChipSac } from "@/components/ui/chip";
import { ProductForm } from "../product-form";
import { getNumberSetting } from "@/lib/settings";

export const metadata = { title: "Thêm sản phẩm" };

export default async function NewProductPage() {
  await requireRole("sadmin", "admin");
  const supabase = await createClient();
  const [{ data: categories }, { data: brands }, roundingUnit] = await Promise.all([
    supabase.from("categories").select("id, name, benefit_pct, description").eq("is_active", true).order("name"),
    supabase.from("brands").select("id, name").order("name"),
    getNumberSetting("pricing.rounding_unit", 1000),
  ]);

  return (
    <div>
      <PageHeader
        title="Thêm sản phẩm"
        description={
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <ChipSac sac="slate">SKU tự sinh</ChipSac>
            <ChipSac sac="slate" title="Mỗi loại hàng Cont/Air là một mã sản phẩm riêng">
              Cont và Air là hai mã riêng
            </ChipSac>
          </span>
        }
      />
      <Khoi title="Thông tin sản phẩm">
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
            date_type: "long",
            expiry_level: "lot",
            expiry_date: null,
            status: "active",
            note: null,
            barcode: null,
          }}
        />
      </Khoi>
    </div>
  );
}
