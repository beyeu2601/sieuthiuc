import Link from "next/link";
import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateVN } from "@/lib/dates";
import { formatMoney, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { MobileCard, MobileCardList } from "@/components/mobile-card";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
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
  const totalMargin = sum("revenue") ? `${Math.round((sum("gross_profit") / sum("revenue")) * 1000) / 10}%` : "N/A";
  const groupLabel = GROUPS[group as keyof typeof GROUPS];
  const margin = (x: Row) => (x.margin == null ? "N/A" : `${x.margin}%`);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Giá vốn và lãi gộp"
        description={`${formatDateVN(r.period.from)} - ${formatDateVN(r.period.to)}`}
      />
      <ReportTabs storeCode={store.code} />
      <ReportFilter
        basePath={`/${store.code}/reports/cogs`}
        preset={r.preset}
        from={r.period.from}
        to={r.period.to}
        allStores={r.allStores}
        canAllStores={r.canAll}
        keep={{ group }}
        extra={
          <label className="block space-y-1 text-sm">
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
        <EmptyState title="Không có giao dịch trong kỳ">
          {r.preset !== "last_month" && (
            <Button
              variant="outline"
              className="mt-3 h-10"
              render={<Link href={`/${store.code}/reports/cogs?preset=last_month&group=${group}${r.allStores ? "&all=1" : ""}`} />}
            >
              Xem tháng trước
            </Button>
          )}
        </EmptyState>
      ) : (
        <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Doanh thu", v: formatMoney(sum("revenue")) },
            { label: "Giá vốn", v: formatMoney(sum("cogs")) },
            { label: "Lãi gộp", v: formatMoney(sum("gross_profit")), neg: sum("gross_profit") < 0 },
            { label: "Biên lãi gộp", v: totalMargin },
          ].map((k) => (
            <div key={k.label} className="rounded-xl border bg-card p-4">
              <div className="text-sm text-muted-foreground">{k.label}</div>
              <div className={`text-xl font-semibold tabular-nums ${k.neg ? "text-destructive" : ""}`}>{k.v}</div>
            </div>
          ))}
        </div>
        <MobileCardList label={`Lãi gộp theo ${groupLabel.toLowerCase()}`}>
          {rows.map((x) => (
            <MobileCard
              key={x.group_key}
              title={LABELS[x.group_label] ?? x.group_label}
              stats={[
                { label: "Lãi gộp", value: <span className={x.gross_profit < 0 ? "text-destructive" : ""}>{formatMoney(x.gross_profit)}</span>, strong: true },
                { label: "Biên", value: margin(x), strong: true },
                { label: "Số lượng", value: formatNumber(x.qty) },
                { label: "Doanh thu", value: formatMoney(x.revenue) },
                { label: "Giá vốn", value: formatMoney(x.cogs) },
              ]}
            />
          ))}
        </MobileCardList>
        <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-56">{groupLabel}</TableHead>
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
                  <TableCell className={`text-right tabular-nums ${x.gross_profit < 0 ? "text-destructive" : ""}`}>{formatMoney(x.gross_profit)}</TableCell>
                  <TableCell className="text-right tabular-nums">{margin(x)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2}>Tổng</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(sum("revenue"))}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(sum("cogs"))}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(sum("gross_profit"))}</TableCell>
                <TableCell className="text-right tabular-nums">{totalMargin}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">
          Doanh thu ở đây là tiền hàng sau giảm giá từng món, chưa trừ giảm giá cả đơn, nên có thể cao hơn doanh thu thuần ở trang Lãi lỗ.
        </p>
        </>
      )}
    </div>
  );
}
