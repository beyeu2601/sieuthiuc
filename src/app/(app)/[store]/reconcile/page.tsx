import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateVN, presetPeriod } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { FilterBar } from "@/components/filter-bar";
import { Input } from "@/components/ui/input";
import { ChiSo, HangChiSo } from "@/components/ui/chi-so";
import type { SacNguNghia } from "@/components/ui/chip";
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

// Lech am la thieu tien (do), duong la du (vang), bang 0 la khop (xanh)
const sacLech = (v: number | null): SacNguNghia => (v == null ? "slate" : v < 0 ? "red" : v > 0 ? "amber" : "emerald");
const nhanLech = (v: number | null) => (v == null ? "chưa có số liệu" : v < 0 ? "thiếu" : v > 0 ? "dư" : "khớp");

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
  // null khi chua ngay nao co so lieu doi chieu (chua chot ca, chua nhap sao ke)
  const cashDiff = rows.some((r) => r.cash_diff != null) ? sum("cash_diff") : null;
  const transferDiff = rows.some((r) => r.transfer_diff != null) ? sum("transfer_diff") : null;
  // Ngay co tien chuyen khoan ma chua nhap sao ke
  const noBank = rows.filter((r) => r.transfer_sales > 0 && r.bank_amount == null).length;

  return (
    <div className="space-y-4">
      <PageHeader title="Đối soát doanh thu" />
      <AutoSubmitForm action={`/${store.code}/reconcile`}>
        <FilterBar>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-end">
            <label className="block min-w-0 space-y-1 text-sm">
              Từ ngày
              <Input type="date" name="from" defaultValue={from} className="min-w-0" />
            </label>
            <label className="block min-w-0 space-y-1 text-sm">
              Đến ngày
              <Input type="date" name="to" defaultValue={to} className="min-w-0" />
            </label>
          </div>
        </FilterBar>
      </AutoSubmitForm>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          Không tải được số liệu.
        </p>
      ) : (
        <>
          {rows.length > 0 && (
            <HangChiSo>
              <ChiSo nhan="Doanh thu" sac="brand" giaTri={formatMoney(sum("revenue"))} phu={`${sum("sales_count")} giao dịch`} />
              <ChiSo nhan={`Lệch tiền mặt: ${nhanLech(cashDiff)}`} sac={sacLech(cashDiff)} giaTri={cashDiff == null ? "-" : formatMoney(cashDiff)} phu="Tiền đếm khi chốt ca so với bán" />
              <ChiSo nhan={`Lệch chuyển khoản: ${nhanLech(transferDiff)}`} sac={sacLech(transferDiff)} giaTri={transferDiff == null ? "-" : formatMoney(transferDiff)} phu="Sao kê so với bán" />
              <ChiSo
                nhan={noBank > 0 ? "Ngày chưa nhập sao kê" : "Sao kê: đã nhập đủ"}
                sac={noBank > 0 ? "amber" : "emerald"}
                giaTri={`${noBank} ngày`}
                phu="Ngày có chuyển khoản"
              />
            </HangChiSo>
          )}
          <div className="overflow-x-auto rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ngày</TableHead>
                  <TableHead className="text-right">Số GD</TableHead>
                  <TableHead className="text-right">Doanh thu</TableHead>
                  <TableHead className="text-right">Tiền mặt (bán)</TableHead>
                  <TableHead
                    className="text-right"
                    title="Tiền mặt theo ca = tiền đếm khi chốt - tiền đầu ca - thu trong ca + chi trong ca, tính cho các ca đã chốt mở trong ngày."
                  >
                    Tiền mặt (theo ca)
                  </TableHead>
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
        </>
      )}
    </div>
  );
}
