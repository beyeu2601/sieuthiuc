import { requireSession } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, formatNumber } from "@/lib/format";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Overview = {
  active_products: number;
  skus_in_stock: number;
  total_qty: number;
  stock_value: number | null;
};

export default async function StoreHome({ params }: { params: Promise<{ store: string }> }) {
  const { store: code } = await params;
  const ctx = await requireSession();
  const store = ctx.stores.find((s) => s.code === code)!;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("store_overview", { p_store_id: store.id });
  const ov = data as Overview | null;

  const cards = [
    { label: "Sản phẩm đang bán", value: formatNumber(ov?.active_products) },
    { label: "Mã còn tồn", value: formatNumber(ov?.skus_in_stock) },
    { label: "Tổng số lượng tồn", value: formatNumber(ov?.total_qty) },
    ...(ov?.stock_value != null ? [{ label: "Giá trị tồn (giá vốn)", value: formatMoney(ov.stock_value) }] : []),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{store.name}</h1>
        <p className="text-sm text-muted-foreground">
          Xin chào {ctx.profile.full_name} ({ROLE_LABEL[ctx.profile.role]})
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Không tải được số liệu tổng quan. Tải lại trang hoặc thử lại sau.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cards.map((c) => (
            <Card key={c.label}>
              <CardHeader>
                <CardDescription>{c.label}</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{c.value}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Giai đoạn triển khai</CardTitle>
          <CardDescription>
            Hệ thống đang ở giai đoạn khởi tạo. Các màn hình bán hàng, nhập hàng, tồn kho, công nợ và báo cáo
            sẽ lần lượt xuất hiện trên thanh điều hướng khi hoàn thành.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
