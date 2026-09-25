import Link from "next/link";
import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateVN, previousPeriod } from "@/lib/dates";
import { formatMoney, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { DailyBars } from "@/components/daily-bars";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ReportFilter } from "./report-filter";
import { ReportTabs } from "./report-tabs";
import { resolveReport, type ReportSP } from "./params";
import { CHANNEL_LABEL } from "../sales/labels";
import { PAYMENT_METHOD_LABEL } from "../receipts/labels";

export const metadata = { title: "Lãi lỗ" };

type Pnl = {
  gross_revenue: number;
  discounts: number;
  returns: number;
  net_revenue: number;
  cogs: number;
  gross_profit: number;
  operating_expenses: number;
  shrinkage: number;
  other_income: number;
  net_profit: number;
  gross_margin: number | null;
  net_margin: number | null;
};

function change(cur: number, prev: number) {
  if (prev === 0) return null;
  return Math.round(((cur - prev) / Math.abs(prev)) * 1000) / 10;
}

export default async function PnlPage({ params, searchParams }: { params: Promise<{ store: string }>; searchParams: Promise<ReportSP> }) {
  const { store: code } = await params;
  const sp = await searchParams;
  const { ctx, store } = await requireStore(code, "sadmin", "admin", "accountant");
  const r = resolveReport(ctx, store, sp);
  const prev = previousPeriod(r.period);
  const supabase = await createClient();
  const args = { p_store_ids: r.storeIds, p_from: r.period.from, p_to: r.period.to, p_channel: r.channel ?? null };
  const [{ data: cur, error }, { data: before }, { data: daily }, { data: exp }, { data: rev }] = await Promise.all([
    supabase.rpc("pnl_report", args),
    supabase.rpc("pnl_report", { ...args, p_from: prev.from, p_to: prev.to }),
    supabase.rpc("pnl_daily", args),
    supabase.rpc("expense_report", { p_store_ids: r.storeIds, p_from: r.period.from, p_to: r.period.to }),
    supabase.rpc("revenue_breakdown", { p_store_ids: r.storeIds, p_from: r.period.from, p_to: r.period.to }),
  ]);
  const p = cur as Pnl | null;
  const b = before as Pnl | null;
  const days = ((daily ?? []) as { day: string; net_revenue: number; cogs: number; gross_profit: number; sales_count: number }[]).map((d) => ({
    ...d,
    net_revenue: Number(d.net_revenue),
    gross_profit: Number(d.gross_profit),
    sales_count: Number(d.sales_count),
  }));
  const expenses = ((exp ?? []) as { category: string; kind: string; amount: number; unpaid: number; tx_count: number }[]).filter((e) => e.kind === "expense");
  const breakdown = rev as {
    by_channel: Record<string, number>;
    by_method: Record<string, number>;
    by_goods_type: Record<string, number>;
    count: number;
  } | null;

  const lines: { label: string; key: keyof Pnl; sign?: "-" | "+"; strong?: boolean; href?: string }[] = [
    { label: "Doanh thu gộp", key: "gross_revenue", href: `/${store.code}/sales?from=${r.period.from}&to=${r.period.to}&status=completed` },
    { label: "Giảm giá", key: "discounts", sign: "-" },
    { label: "Hoàn trả", key: "returns", sign: "-" },
    { label: "Doanh thu thuần", key: "net_revenue", strong: true },
    { label: "Giá vốn hàng bán (COGS)", key: "cogs", sign: "-", href: `/${store.code}/reports/cogs?from=${r.period.from}&to=${r.period.to}` },
    { label: "Lãi gộp", key: "gross_profit", strong: true },
    { label: "Chi phí vận hành", key: "operating_expenses", sign: "-", href: `/${store.code}/cash?from=${r.period.from}&to=${r.period.to}&kind=expense&approval=approved` },
    { label: "Hao hụt và hàng hủy", key: "shrinkage", sign: "-" },
    { label: "Thu khác", key: "other_income", sign: "+" },
    { label: "Lãi ròng", key: "net_profit", strong: true },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Lãi lỗ"
        description={`${r.allStores ? "Tất cả cửa hàng" : store.name} - ${formatDateVN(r.period.from)} đến ${formatDateVN(r.period.to)}. So với kỳ trước ${formatDateVN(prev.from)} - ${formatDateVN(prev.to)}.`}
      />
      <ReportTabs storeCode={store.code} />
      <ReportFilter
        basePath={`/${store.code}/reports`}
        preset={r.preset}
        from={r.period.from}
        to={r.period.to}
        channel={r.channel}
        showChannel
        allStores={r.allStores}
        canAllStores={r.canAll}
      />
      {r.channel && (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm">Đang lọc theo kênh: chi phí và thu khác không chia theo kênh nên không tính.</p>
      )}
      {error || !p ? (
        <p role="alert" className="text-sm text-destructive">
          Không tải được báo cáo.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Doanh thu thuần", v: p.net_revenue, pv: b?.net_revenue },
              { label: "Lãi gộp", v: p.gross_profit, pv: b?.gross_profit, sub: p.gross_margin == null ? "Biên N/A" : `Biên ${p.gross_margin}%` },
              { label: "Lãi ròng", v: p.net_profit, pv: b?.net_profit, sub: p.net_margin == null ? "Biên N/A" : `Biên ${p.net_margin}%` },
              { label: "Số giao dịch", v: breakdown?.count ?? 0, pv: undefined, count: true },
            ].map((k) => {
              const c = k.pv == null ? null : change(k.v, k.pv);
              return (
                <div key={k.label} className="rounded-xl border bg-background p-4">
                  <div className="text-sm text-muted-foreground">{k.label}</div>
                  <div className={cn("text-xl font-semibold tabular-nums", k.v < 0 && "text-red-700")}>
                    {k.count ? formatNumber(k.v) : formatMoney(k.v)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {k.sub}
                    {k.sub && c != null ? " - " : ""}
                    {c != null && `${c > 0 ? "+" : ""}${c}% so với kỳ trước`}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <section className="overflow-x-auto rounded-xl border bg-background">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Khoản mục</TableHead>
                    <TableHead className="text-right">Kỳ này</TableHead>
                    <TableHead className="text-right">Kỳ trước</TableHead>
                    <TableHead className="text-right">Thay đổi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l) => {
                    const v = p[l.key] as number;
                    const pv = (b?.[l.key] as number) ?? 0;
                    const c = change(v, pv);
                    return (
                      <TableRow key={l.key} className={l.strong ? "bg-muted/50 font-semibold" : ""}>
                        <TableCell>
                          {l.href ? (
                            <Link href={l.href} className="underline-offset-4 hover:underline">
                              {l.sign ? `${l.sign} ` : ""}
                              {l.label}
                            </Link>
                          ) : (
                            <>
                              {l.sign ? `${l.sign} ` : ""}
                              {l.label}
                            </>
                          )}
                        </TableCell>
                        <TableCell className={cn("text-right tabular-nums", v < 0 && "text-red-700")}>{formatMoney(v)}</TableCell>
                        <TableCell className="text-right text-muted-foreground tabular-nums">{formatMoney(pv)}</TableCell>
                        <TableCell className="text-right text-muted-foreground tabular-nums">{c == null ? "-" : `${c > 0 ? "+" : ""}${c}%`}</TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow>
                    <TableCell>Biên lãi gộp / biên lãi ròng</TableCell>
                    <TableCell className="text-right tabular-nums" colSpan={3}>
                      {p.gross_margin == null ? "N/A" : `${p.gross_margin}%`} / {p.net_margin == null ? "N/A" : `${p.net_margin}%`}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <p className="p-3 text-xs text-muted-foreground">
                Thanh toán nhà cung cấp và trả khoản chi không vào lãi lỗ (đã tính qua giá vốn và chi phí ghi theo ngày phát sinh). Hoàn trả và hàng
                hủy có ở giai đoạn 2.
              </p>
            </section>

            <section className="space-y-3 rounded-xl border bg-background p-4 text-sm">
              <h2 className="font-medium">Cơ cấu doanh thu</h2>
              {breakdown && (
                <>
                  <Breakdown title="Theo kênh" data={breakdown.by_channel} labels={CHANNEL_LABEL} />
                  <Breakdown title="Theo phương thức" data={breakdown.by_method} labels={PAYMENT_METHOD_LABEL} />
                  <Breakdown title="Theo loại hàng (tiền hàng)" data={breakdown.by_goods_type} labels={{ cont: "Cont", air: "Air" }} />
                </>
              )}
              <h2 className="pt-2 font-medium">Chi phí theo nhóm</h2>
              {expenses.length === 0 ? (
                <p className="text-muted-foreground">Không có chi phí trong kỳ.</p>
              ) : (
                <ul className="space-y-1">
                  {expenses.map((e) => (
                    <li key={e.category} className="flex justify-between gap-2">
                      <span>
                        {e.category}
                        {e.unpaid > 0 && <span className="text-xs text-muted-foreground"> (chưa trả {formatMoney(e.unpaid)})</span>}
                      </span>
                      <span className="tabular-nums">{formatMoney(e.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="rounded-xl border bg-background p-4">
            <h2 className="mb-2 font-medium">Doanh thu thuần theo ngày</h2>
            <DailyBars label="Doanh thu thuần" data={days.map((d) => ({ day: d.day, value: d.net_revenue }))} />
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-muted-foreground">Xem bảng số liệu theo ngày</summary>
              <div className="mt-2 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ngày</TableHead>
                      <TableHead className="text-right">Số GD</TableHead>
                      <TableHead className="text-right">Doanh thu thuần</TableHead>
                      <TableHead className="text-right">Lãi gộp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {days
                      .filter((d) => d.sales_count > 0)
                      .map((d) => (
                        <TableRow key={d.day}>
                          <TableCell>{formatDateVN(d.day)}</TableCell>
                          <TableCell className="text-right">{d.sales_count}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatMoney(d.net_revenue)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatMoney(d.gross_profit)}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </details>
          </section>
        </>
      )}
    </div>
  );
}

function Breakdown({ title, data, labels }: { title: string; data: Record<string, number>; labels: Record<string, string> }) {
  const entries = Object.entries(data ?? {}).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  return (
    <div>
      <div className="text-muted-foreground">{title}</div>
      {entries.length === 0 ? (
        <div className="text-muted-foreground">-</div>
      ) : (
        entries.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2">
            <span>{labels[k] ?? k}</span>
            <span className="tabular-nums">
              {formatMoney(v)} <span className="text-xs text-muted-foreground">({total ? Math.round((v / total) * 100) : 0}%)</span>
            </span>
          </div>
        ))
      )}
    </div>
  );
}
