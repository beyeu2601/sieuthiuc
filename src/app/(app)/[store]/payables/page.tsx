import Link from "next/link";
import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getNumberSetting } from "@/lib/settings";
import { diffDays, formatDateVN, todayVN } from "@/lib/dates";
import { formatDateTime, formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { PAYMENT_METHOD_LABEL } from "../receipts/labels";

export const metadata = { title: "Công nợ nhà cung cấp" };

type Overview = {
  total_amount: number;
  paid_amount: number;
  remaining: number;
  count_unpaid: number;
  count_partial: number;
  count_paid: number;
  due_soon_amount: number;
  due_soon_count: number;
  overdue_amount: number;
  overdue_count: number;
  top_suppliers: { id: string; name: string; remaining: number }[];
};

type Debt = {
  id: string;
  code: string;
  supplier_id: string;
  receipt_id: string | null;
  issued_date: string;
  due_date: string | null;
  total_amount: number;
  paid_amount: number;
  remaining: number;
  status: string;
  suppliers: { name: string } | null;
  purchase_receipts: { code: string } | null;
};

const DUE = {
  overdue: { label: "Quá hạn", variant: "destructive" },
  due_soon: { label: "Sắp đến hạn", variant: "default" },
  not_due: { label: "Chưa đến hạn", variant: "outline" },
  paid: { label: "Đã trả", variant: "secondary" },
} as const;

export default async function PayablesPage({
  params,
  searchParams,
}: {
  params: Promise<{ store: string }>;
  searchParams: Promise<{ tab?: string; supplier?: string }>;
}) {
  const { store: code } = await params;
  const sp = await searchParams;
  const tab = sp.tab ?? "due";
  const { store } = await requireStore(code, "sadmin", "admin", "accountant");
  const supabase = await createClient();
  const [{ data: ov }, { data: debts }, { data: payments }, dueSoonDays] = await Promise.all([
    supabase.rpc("debt_overview", { p_store_ids: [store.id] }),
    supabase
      .from("supplier_debts")
      .select("id, code, supplier_id, receipt_id, issued_date, due_date, total_amount, paid_amount, remaining, status, suppliers(name), purchase_receipts(code)")
      .eq("store_id", store.id)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(1000),
    tab === "payments"
      ? supabase
          .from("supplier_payments")
          .select("id, code, payment_date, amount, method, reference, note, created_at, suppliers(name), supplier_payment_allocations(amount, remaining_before, remaining_after, supplier_debts(code))")
          .eq("store_id", store.id)
          .order("created_at", { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [] as never[] }),
    getNumberSetting("debt.due_soon_days", 3, store.id),
  ]);
  const o = ov as Overview | null;
  const today = todayVN();
  const dueStatus = (d: Debt): keyof typeof DUE =>
    d.remaining <= 0 ? "paid" : !d.due_date ? "not_due" : d.due_date < today ? "overdue" : diffDays(today, d.due_date) <= dueSoonDays ? "due_soon" : "not_due";
  const all = ((debts ?? []) as unknown as Debt[]).filter((d) => !sp.supplier || d.supplier_id === sp.supplier);
  const open = all.filter((d) => d.remaining > 0);
  const bySupplier = new Map<string, { name: string; total: number; paid: number; remaining: number; count: number; overdue: number }>();
  for (const d of all) {
    const g = bySupplier.get(d.supplier_id) ?? { name: d.suppliers?.name ?? "?", total: 0, paid: 0, remaining: 0, count: 0, overdue: 0 };
    g.total += d.total_amount;
    g.paid += d.paid_amount;
    g.remaining += d.remaining;
    g.count += 1;
    if (dueStatus(d) === "overdue") g.overdue += d.remaining;
    bySupplier.set(d.supplier_id, g);
  }

  const tabs = [
    { k: "due", label: `Cần thanh toán (${open.length})` },
    { k: "supplier", label: "Theo nhà cung cấp" },
    { k: "all", label: "Tất cả khoản nợ" },
    { k: "payments", label: "Lịch sử thanh toán" },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Công nợ nhà cung cấp"
        description="Công nợ tự sinh khi xác nhận phiếu nhập chưa trả đủ."
        actions={<Button render={<Link href={`/${store.code}/payables/pay${sp.supplier ? `?supplier=${sp.supplier}` : ""}`} />}>Ghi thanh toán</Button>}
      />
      {o && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Còn nợ" value={formatMoney(o.remaining)} sub={`${o.count_unpaid + o.count_partial} khoản`} />
          <Kpi label="Quá hạn" value={formatMoney(o.overdue_amount)} sub={`${o.overdue_count} khoản`} tone={o.overdue_count > 0 ? "bad" : undefined} />
          <Kpi label={`Đến hạn trong ${dueSoonDays} ngày`} value={formatMoney(o.due_soon_amount)} sub={`${o.due_soon_count} khoản`} tone={o.due_soon_count > 0 ? "warn" : undefined} />
          <Kpi label="Đã trả / tổng phát sinh" value={formatMoney(o.paid_amount)} sub={`trên ${formatMoney(o.total_amount)}`} />
        </div>
      )}
      {o && o.top_suppliers.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Nợ nhiều nhất:{" "}
          {o.top_suppliers.map((s, i) => (
            <span key={s.id}>
              {i > 0 && ", "}
              <Link href={`?tab=all&supplier=${s.id}`} className="underline underline-offset-4">
                {s.name}
              </Link>{" "}
              {formatMoney(s.remaining)}
            </span>
          ))}
        </p>
      )}
      <div className="flex flex-wrap gap-1" role="tablist">
        {tabs.map((t) => (
          <Link
            key={t.k}
            role="tab"
            aria-selected={tab === t.k}
            href={`?tab=${t.k}${sp.supplier ? `&supplier=${sp.supplier}` : ""}`}
            className={cn("inline-flex h-9 items-center rounded-lg border px-3 text-sm", tab === t.k ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
          >
            {t.label}
          </Link>
        ))}
        {sp.supplier && (
          <Link href={`?tab=${tab}`} className="inline-flex h-9 items-center px-3 text-sm underline underline-offset-4">
            Bỏ lọc nhà cung cấp
          </Link>
        )}
      </div>

      {tab === "supplier" ? (
        bySupplier.size === 0 ? (
          <EmptyState title="Chưa có công nợ" />
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nhà cung cấp</TableHead>
                  <TableHead className="text-right">Số khoản</TableHead>
                  <TableHead className="text-right">Phát sinh</TableHead>
                  <TableHead className="text-right">Đã trả</TableHead>
                  <TableHead className="text-right">Còn nợ</TableHead>
                  <TableHead className="text-right">Quá hạn</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...bySupplier.entries()]
                  .sort((a, b) => b[1].remaining - a[1].remaining)
                  .map(([id, g]) => (
                    <TableRow key={id}>
                      <TableCell>
                        <Link href={`?tab=all&supplier=${id}`} className="font-medium hover:underline">
                          {g.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right">{g.count}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(g.total)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(g.paid)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatMoney(g.remaining)}</TableCell>
                      <TableCell className={cn("text-right tabular-nums", g.overdue > 0 && "text-red-700")}>{formatMoney(g.overdue)}</TableCell>
                      <TableCell className="text-right">
                        {g.remaining > 0 && (
                          <Button size="sm" variant="outline" render={<Link href={`/${store.code}/payables/pay?supplier=${id}`} />}>
                            Thanh toán
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        )
      ) : tab === "payments" ? (
        (payments ?? []).length === 0 ? (
          <EmptyState title="Chưa có thanh toán nào" />
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã</TableHead>
                  <TableHead>Ngày</TableHead>
                  <TableHead>Nhà cung cấp</TableHead>
                  <TableHead>Phương thức</TableHead>
                  <TableHead className="text-right">Số tiền</TableHead>
                  <TableHead>Phân bổ (số dư trước - sau)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(payments ?? []).map((p) => {
                  const allocs = (p.supplier_payment_allocations ?? []) as unknown as {
                    amount: number;
                    remaining_before: number;
                    remaining_after: number;
                    supplier_debts: { code: string } | null;
                  }[];
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.code}</TableCell>
                      <TableCell>{formatDateVN(p.payment_date)}</TableCell>
                      <TableCell>{(p.suppliers as unknown as { name: string } | null)?.name}</TableCell>
                      <TableCell>
                        {PAYMENT_METHOD_LABEL[p.method as keyof typeof PAYMENT_METHOD_LABEL]}
                        {p.reference ? ` - ${p.reference}` : ""}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(p.amount)}</TableCell>
                      <TableCell className="text-xs">
                        {allocs.length === 0
                          ? "Trả ngay khi nhập hàng"
                          : allocs.map((a, i) => (
                              <div key={i}>
                                {a.supplier_debts?.code}: {formatMoney(a.amount)} ({formatMoney(a.remaining_before)} - {formatMoney(a.remaining_after)})
                              </div>
                            ))}
                        <div className="text-muted-foreground">{formatDateTime(p.created_at)}</div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )
      ) : (
        (() => {
          const rows = tab === "due" ? open.sort((a, b) => (a.due_date ?? "9999") .localeCompare(b.due_date ?? "9999")) : all;
          return rows.length === 0 ? (
            <EmptyState title={tab === "due" ? "Không có khoản nào cần thanh toán" : "Chưa có công nợ"} />
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-background">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã nợ</TableHead>
                    <TableHead>Nhà cung cấp</TableHead>
                    <TableHead>Phiếu nhập</TableHead>
                    <TableHead>Ngày phát sinh</TableHead>
                    <TableHead>Hạn trả</TableHead>
                    <TableHead className="text-right">Tổng</TableHead>
                    <TableHead className="text-right">Còn nợ</TableHead>
                    <TableHead>Tình trạng</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((d) => {
                    const ds = DUE[dueStatus(d)];
                    return (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">{d.code}</TableCell>
                        <TableCell>{d.suppliers?.name}</TableCell>
                        <TableCell>
                          {d.receipt_id ? (
                            <Link href={`/${store.code}/receipts/${d.receipt_id}`} className="underline underline-offset-4">
                              {d.purchase_receipts?.code}
                            </Link>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>{formatDateVN(d.issued_date)}</TableCell>
                        <TableCell>{formatDateVN(d.due_date)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(d.total_amount)}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{formatMoney(d.remaining)}</TableCell>
                        <TableCell>
                          <Badge variant={ds.variant}>{ds.label}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          );
        })()
      )}
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "bad" | "warn" }) {
  return (
    <div className={cn("rounded-xl border bg-background p-4", tone === "bad" && "border-red-300", tone === "warn" && "border-amber-300")}>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={cn("text-xl font-semibold tabular-nums", tone === "bad" && "text-red-700")}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
