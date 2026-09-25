import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateVN } from "@/lib/dates";
import { formatMoney, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { NativeSelect } from "@/components/native-select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReportFilter } from "../report-filter";
import { ReportTabs } from "../report-tabs";
import { resolveReport, type ReportSP } from "../params";
import { CHANNEL_LABEL } from "../../sales/labels";

export const metadata = { title: "Giá vốn và lãi gộp" };

const GROUPS = { product: "Sản phẩm", category: "Nhóm hàng", goods_type: "Loại hàng", channel: "Kênh" } as const;
const LABELS: Record<string, string> = { ...CHANNEL_LABEL, cont: "Cont", air: "Air" };

type Row = { group_key: string; group_label: string; qty: number; revenue: number; cogs: number; gross_profit: number; margin: number | null };

export default async function CogsPage({
  params,
  searchParams,
}: {
  params: Promise<{ store: string }>;
  searchParams: Promise<ReportSP & { group?: string }>;
}) {
  const { store: code } = await params;
  const sp = await searchParams;
  const { ctx, store } = await requireStore(code, "sadmin", "admin", "accountant");
  const r = resolveReport(ctx, store, sp);
  const group = sp.group && sp.group in GROUPS ? sp.group : "product";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cogs_report", {
    p_store_ids: r.storeIds,
    p_from: r.period.from,
    p_to: r.period.to,
    p_group: group,
  });
  const rows = (data ?? []) as Row[];
  const sum = (k: "revenue" | "cogs" | "gross_profit") => rows.reduce((s, x) => s + Number(x[k]), 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Giá vốn và lãi gộp"
        description={`${formatDateVN(r.period.from)} - ${formatDateVN(r.period.to)}. Doanh thu dòng là tiền hàng sau giảm giá dòng, chưa trừ giảm giá cả đơn.`}
      />
      <ReportTabs storeCode={store.code} />
      <ReportFilter
        basePath={`/${store.code}/reports/cogs`}
        preset={r.preset}
        from={r.period.from}
        to={r.period.to}
        allStores={r.allStores}
        canAllStores={r.canAll}
        extra={
          <label className="space-y-1 text-sm">
            Nhóm theo
            <NativeSelect name="group" defaultValue={group}>
              {Object.entries(GROUPS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </NativeSelect>
          </label>
        }
      />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          Không tải được báo cáo.
        </p>
      ) : rows.length === 0 ? (
        <EmptyState title="Không có giao dịch trong kỳ" />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-56">{GROUPS[group as keyof typeof GROUPS]}</TableHead>
                <TableHead className="text-right">Số lượng</TableHead>
                <TableHead className="text-right">Doanh thu</TableHead>
                <TableHead className="text-right">Giá vốn</TableHead>
                <TableHead className="text-right">Lãi gộp</TableHead>
                <TableHead className="text-right">Biên</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((x) => (
                <TableRow key={x.group_key}>
                  <TableCell>{LABELS[x.group_label] ?? x.group_label}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(x.qty)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(x.revenue)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(x.cogs)}</TableCell>
                  <TableCell className={`text-right tabular-nums ${x.gross_profit < 0 ? "text-red-700" : ""}`}>{formatMoney(x.gross_profit)}</TableCell>
                  <TableCell className="text-right tabular-nums">{x.margin == null ? "N/A" : `${x.margin}%`}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2}>Tổng</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(sum("revenue"))}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(sum("cogs"))}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(sum("gross_profit"))}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {sum("revenue") ? `${Math.round((sum("gross_profit") / sum("revenue")) * 1000) / 10}%` : "N/A"}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </div>
  );
}
