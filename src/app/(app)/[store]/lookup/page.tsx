import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { ChipSac } from "@/components/ui/chip";
import { ThanhTienDo } from "@/components/ui/thanh-tien-do";
import { LookupClient } from "./lookup-client";

export const metadata = { title: "Tra cứu sản phẩm" };

export default async function LookupPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: code } = await params;
  const { ctx, store } = await requireStore(code);
  const role = ctx.profile.role;
  // add_product_barcode cho phep sadmin/admin/staff
  const canAssign = role !== "accountant";
  const isManager = role === "sadmin" || role === "admin";

  // Tien do gan ma vach (chi quan ly doc duoc bang products)
  let progress: { withCode: number; total: number } | null = null;
  if (isManager) {
    const supabase = await createClient();
    const [all, coded] = await Promise.all([
      supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("products").select("id, product_barcodes!inner(id)", { count: "exact", head: true }).eq("status", "active"),
    ]);
    if (all.count != null && coded.count != null) progress = { withCode: coded.count, total: all.count };
  }

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Tra cứu sản phẩm" description={<ChipSac sac="slate" className="mt-1.5">{store.name}</ChipSac>} />
      {progress && progress.withCode < progress.total && (
        <div className="mb-4 rounded-xl border bg-card p-3" title="Quét mã của hàng chưa có mã vạch để gán ngay cho sản phẩm.">
          <p className="mb-2 text-xs text-muted-foreground">Gán mã vạch khi quét</p>
          <ThanhTienDo
            giaTri={progress.withCode}
            tong={progress.total}
            donVi="sản phẩm có mã"
            nhanAria={`${formatNumber(progress.withCode)} trên ${formatNumber(progress.total)} sản phẩm đang bán đã có mã vạch`}
          />
        </div>
      )}
      <LookupClient storeId={store.id} canAssign={canAssign} />
    </div>
  );
}
