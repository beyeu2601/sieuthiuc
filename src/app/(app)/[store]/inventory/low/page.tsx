import Link from "next/link";
import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InventoryTabs } from "../inventory-tabs";
import { STOCK_STATUS } from "../labels";

export const metadata = { title: "Cần nhập thêm" };

type Row = {
  product_id: string;
  sku: string;
  name: string;
  unit: string;
  qty_available: number;
  min_stock: number;
  stock_status: "out" | "low" | "in_stock";
  suggest_qty: number;
};

export default async function LowStockPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: code } = await params;
  const { ctx, store } = await requireStore(code);
  const supabase = await createClient();
  const { data } = await supabase.rpc("inventory_status", { p_store_id: store.id, p_status: "low_out", p_limit: 500 });
  const rows = (data ?? []) as Row[];
  const withSuggest = rows.filter((r) => Number(r.suggest_qty) > 0);
  const prefill = withSuggest.map((r) => `${r.product_id}:${Math.ceil(Number(r.suggest_qty))}`).join(",");
  const canCreate = ctx.profile.role !== "accountant";

  return (
    <div>
      <PageHeader
        title="Cần nhập thêm"
        description="Sản phẩm đang bán có tồn khả dụng dưới mức tối thiểu. Gợi ý nhập = tồn tối đa - khả dụng (mặc định tối đa = 3 lần tối thiểu)."
        actions={
          canCreate &&
          withSuggest.length > 0 && (
            <Button render={<Link href={`/${store.code}/receipts/new?products=${prefill}`} />}>
              Tạo phiếu nhập từ danh sách ({withSuggest.length})
            </Button>
          )
        }
      />
      <InventoryTabs storeCode={store.code} />
      <div className="mt-3">
        {rows.length === 0 ? (
          <EmptyState title="Không có sản phẩm nào dưới mức tối thiểu" />
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-56">Sản phẩm</TableHead>
                  <TableHead>ĐVT</TableHead>
                  <TableHead className="text-right">Khả dụng</TableHead>
                  <TableHead className="text-right">Tối thiểu</TableHead>
                  <TableHead className="text-right">Gợi ý nhập</TableHead>
                  <TableHead>Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.product_id}>
                    <TableCell>
                      {r.name}
                      <div className="text-xs text-muted-foreground">{r.sku}</div>
                    </TableCell>
                    <TableCell>{r.unit}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(r.qty_available)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(r.min_stock)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatNumber(Math.ceil(Number(r.suggest_qty)))}</TableCell>
                    <TableCell>
                      <Badge variant={STOCK_STATUS[r.stock_status].variant}>{STOCK_STATUS[r.stock_status].label}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
