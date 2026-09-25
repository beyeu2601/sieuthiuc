import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateVN, presetPeriod } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { BankCell } from "./bank-cell";

export const metadata = { title: "Đối soát doanh thu" };

type Row = {
  day: string;
  sales_count: number;
  revenue: number;
  cash_sales: number;
  transfer_sales: number;
  other_sales: number;
  shift_cash: number | null;
  cash_diff: number | null;
  bank_amount: number | null;
  transfer_diff: number | null;
  note: string | null;
};

function Diff({ v }: { v: number | null }) {
  if (v == null) return <span className="text-muted-foreground">-</span>;
  return <span className={cn("tabular-nums", v < 0 ? "text-destructive" : v > 0 ? "text-warning" : "text-success")}>{formatMoney(v)}</span>;
}

export default async function ReconcilePage({
  params,
  searchParams,
}: {
  params: Promise<{ store: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { store: code } = await params;
  const sp = await searchParams;
  const { store } = await requireStore(code, "sadmin", "admin", "accountant");
  const m = presetPeriod("month");
  const from = sp.from || m.from;
  const to = sp.to || m.to;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reconcile_report", { p_store_id: store.id, p_from: from, p_to: to });
  const rows = ((data ?? []) as Row[]).filter((r) => r.sales_count > 0 || r.shift_cash != null || r.bank_amount != null || r.note);
  const sum = (k: keyof Row) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Đối soát doanh thu"
        description="Tiền mặt bán hàng so với tiền đếm khi chốt ca; chuyển khoản so với sao kê ngân hàng nhập tay theo ngày."
      />
      <form className="flex flex-wrap items-end gap-2">
        <label className="space-y-1 text-sm">
          Từ ngày
          <Input type="date" name="from" defaultValue={from} />
        </label>
        <label className="space-y-1 text-sm">
          Đến ngày
          <Input type="date" name="to" defaultValue={to} />
        </label>
        <Button type="submit" variant="secondary">
          Xem
        </Button>
      </form>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          Không tải được số liệu.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ngày</TableHead>
                <TableHead className="text-right">Số GD</TableHead>
                <TableHead className="text-right">Doanh thu</TableHead>
                <TableHead className="text-right">Tiền mặt (bán)</TableHead>
                <TableHead className="text-right">Tiền mặt (theo ca)</TableHead>
                <TableHead className="text-right">Lệch tiền mặt</TableHead>
                <TableHead className="text-right">Chuyển khoản</TableHead>
                <TableHead className="min-w-44">Sao kê ngân hàng / ghi chú</TableHead>
                <TableHead className="text-right">Lệch CK</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                    Không có phát sinh trong kỳ
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.day}>
                    <TableCell className="whitespace-nowrap">{formatDateVN(r.day)}</TableCell>
                    <TableCell className="text-right">{r.sales_count}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(r.revenue)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(r.cash_sales)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.shift_cash == null ? "Chưa chốt ca" : formatMoney(r.shift_cash)}</TableCell>
                    <TableCell className="text-right">
                      <Diff v={r.cash_diff} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(r.transfer_sales)}</TableCell>
                    <TableCell>
                      <BankCell storeCode={store.code} storeId={store.id} day={r.day} bank={r.bank_amount} note={r.note} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Diff v={r.transfer_diff} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {rows.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell>Tổng</TableCell>
                  <TableCell className="text-right">{sum("sales_count")}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(sum("revenue"))}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(sum("cash_sales"))}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(sum("shift_cash"))}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(sum("cash_diff"))}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(sum("transfer_sales"))}</TableCell>
                  <TableCell className="tabular-nums">{formatMoney(sum("bank_amount"))}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(sum("transfer_diff"))}</TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Tiền mặt theo ca = tiền đếm khi chốt - tiền đầu ca - thu trong ca + chi trong ca, tính cho các ca đã chốt mở trong ngày.
      </p>
    </div>
  );
}
