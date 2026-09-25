import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSetting } from "@/lib/settings";
import { formatDateVN } from "@/lib/dates";
import { formatMoney, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { NativeSelect } from "@/components/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReportFilter } from "../report-filter";
import { ReportTabs } from "../report-tabs";
import { resolveReport, type ReportSP } from "../params";

export const metadata = { title: "Bán chạy" };

const ORDERS = { by_qty: "Số lượng", by_revenue: "Doanh thu", by_gross_profit: "Lãi gộp" } as const;

type Row = { product_id: string; sku: string; name: string; qty: number; revenue: number; gross_profit: number | null };

export default async function BestSellersPage({
  params,
  searchParams,
}: {
  params: Promise<{ store: string }>;
  searchParams: Promise<ReportSP & { order?: string }>;
}) {
  const { store: code } = await params;
  const sp = await searchParams;
  const { ctx, store } = await requireStore(code, "sadmin", "admin", "accountant");
  const r = resolveReport(ctx, store, sp);
  const def = await getSetting<string>("report.best_seller_order", "by_qty", store.id);
  const order = sp.order && sp.order in ORDERS ? sp.order : def;
  const supabase = await createClient();
  const { data } = await supabase.rpc("best_sellers", {
    p_store_ids: r.storeIds,
    p_from: r.period.from,
    p_to: r.period.to,
    p_order: order,
    p_limit: 50,
  });
  const rows = (data ?? []) as Row[];

  return (
    <div className="space-y-4">
      <PageHeader title="Bán chạy" description={`${formatDateVN(r.period.from)} - ${formatDateVN(r.period.to)}. Không tính giao dịch đã hủy.`} />
      <ReportTabs storeCode={store.code} />
      <ReportFilter
        basePath={`/${store.code}/reports/best-sellers`}
        preset={r.preset}
        from={r.period.from}
        to={r.period.to}
        allStores={r.allStores}
        canAllStores={r.canAll}
        keep={{ order }}
        extra={
          <label className="block space-y-1 text-sm">
            Xếp theo
            <NativeSelect name="order" defaultValue={order}>
              {Object.entries(ORDERS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </NativeSelect>
          </label>
        }
      />
      {rows.length === 0 ? (
        <EmptyState title="Chưa có dữ liệu bán trong kỳ" />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead className="min-w-56">Sản phẩm</TableHead>
                <TableHead className="text-right">Số lượng</TableHead>
                <TableHead className="text-right">Doanh thu</TableHead>
                <TableHead className="text-right">Lãi gộp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((x, i) => (
                <TableRow key={x.product_id}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell className="min-w-56 whitespace-normal">
                    {x.name}
                    <div className="text-xs text-muted-foreground">{x.sku}</div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(x.qty)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(x.revenue)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(x.gross_profit)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
