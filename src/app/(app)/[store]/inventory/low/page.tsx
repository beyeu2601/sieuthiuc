import Link from "next/link";
import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ChipSac } from "@/components/ui/chip";
import { MobileCard, MobileCardList } from "@/components/mobile-card";
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
  const { data } = await supabase.rpc("inventory_status", { p_store_id: store.id, p_status: ["low", "out"], p_limit: 500 });
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
          <>
            <MobileCardList label="Sản phẩm cần nhập thêm">
              {rows.map((r) => (
                <MobileCard
                  key={r.product_id}
                  title={r.name}
                  subtitle={`${r.sku} - ${r.unit}`}
                  badge={<ChipSac sac={STOCK_STATUS[r.stock_status].sac}>{STOCK_STATUS[r.stock_status].label}</ChipSac>}
                  stats={[
                    {
                      label: "Gợi ý nhập",
                      value: formatNumber(Math.ceil(Number(r.suggest_qty))),
                      strong: true,
                    },
                    { label: "Khả dụng", value: formatNumber(r.qty_available) },
                    { label: "Tối thiểu", value: formatNumber(r.min_stock) },
                  ]}
                />
              ))}
            </MobileCardList>
            <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
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
                      <TableCell className="min-w-56 whitespace-normal">
                        {r.name}
                        <div className="text-xs text-muted-foreground">{r.sku}</div>
                      </TableCell>
                      <TableCell>{r.unit}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(r.qty_available)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(r.min_stock)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatNumber(Math.ceil(Number(r.suggest_qty)))}
                      </TableCell>
                      <TableCell>
                        <ChipSac sac={STOCK_STATUS[r.stock_status].sac}>{STOCK_STATUS[r.stock_status].label}</ChipSac>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
