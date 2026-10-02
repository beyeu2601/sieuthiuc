import Link from "next/link";
import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getNumberSetting } from "@/lib/settings";
import { diffDays, formatDateVN, todayVN } from "@/lib/dates";
import { formatDateTime, formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { MobileCard, MobileCardList } from "@/components/mobile-card";
import { Button } from "@/components/ui/button";
import { ChiSo, HangChiSo } from "@/components/ui/chi-so";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { PAYMENT_METHOD_LABEL } from "../receipts/labels";
import { DUE } from "./labels";
import { DebtBoard, type DebtCardData } from "./debt-board";

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
  purchase_receipts: {
    code: string;
    extra_cost_total: number;
    paid_amount: number;
    purchase_receipt_items: { line_no: number; qty: number; unit: string; unit_cost: number; line_total: number; products: { name: string } | null }[];
  } | null;
};

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
  const [{ data: ov }, { data: debts }, { data: payments }, dueSoonDays, { data: accounts }] = await Promise.all([
    supabase.rpc("debt_overview", { p_store_ids: [store.id] }),
    supabase
      .from("supplier_debts")
      .select("id, code, supplier_id, receipt_id, issued_date, due_date, total_amount, paid_amount, remaining, status, suppliers(name), purchase_receipts(code, extra_cost_total, paid_amount, purchase_receipt_items(line_no, qty, unit, unit_cost, line_total, products(name)))")
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
    supabase.from("money_accounts").select("id, name, kind").eq("is_active", true).order("sort_order").order("name"),
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
        actions={<Button render={<Link href={`/${store.code}/payables/pay${sp.supplier ? `?supplier=${sp.supplier}` : ""}`} />}>Ghi thanh toán</Button>}
      />
      {o && (
        <HangChiSo>
          <ChiSo nhan="Còn nợ" sac="brand" giaTri={formatMoney(o.remaining)} phu={`${o.count_unpaid + o.count_partial} khoản`} />
          <ChiSo
            nhan={o.overdue_count > 0 ? "Quá hạn" : "Quá hạn: không có"}
            sac={o.overdue_count > 0 ? "red" : "emerald"}
            giaTri={formatMoney(o.overdue_amount)}
            phu={`${o.overdue_count} khoản`}
          />
          <ChiSo
            nhan={`Đến hạn trong ${dueSoonDays} ngày`}
            sac={o.due_soon_count > 0 ? "amber" : "emerald"}
            giaTri={formatMoney(o.due_soon_amount)}
            phu={`${o.due_soon_count} khoản`}
          />
          <ChiSo nhan="Đã trả" sac="emerald" giaTri={formatMoney(o.paid_amount)} phu={`trên tổng phát sinh ${formatMoney(o.total_amount)}`} />
        </HangChiSo>
      )}
      {o && o.top_suppliers.length > 0 && (
        <p className="text-xs text-muted-foreground">
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
          <>
            <MobileCardList label="Công nợ theo nhà cung cấp">
              {[...bySupplier.entries()]
                .sort((a, b) => b[1].remaining - a[1].remaining)
                .map(([id, g]) => (
                  <MobileCard
                    key={id}
                    title={
                      <Link href={`?tab=all&supplier=${id}`} className="underline-offset-4 hover:underline">
                        {g.name}
                      </Link>
                    }
                    subtitle={`${g.count} khoản`}
                    badge={
                      g.remaining > 0 && (
                        <Button size="sm" variant="outline" render={<Link href={`/${store.code}/payables/pay?supplier=${id}`} />}>
                          Thanh toán
                        </Button>
                      )
                    }
                    stats={[
                      { label: "Còn nợ", value: formatMoney(g.remaining), strong: true },
                      { label: "Quá hạn", value: <span className={cn(g.overdue > 0 && "font-medium text-chu-red")}>{formatMoney(g.overdue)}</span> },
                      { label: "Đã trả", value: formatMoney(g.paid) },
                    ]}
                  />
                ))}
            </MobileCardList>
            <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
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
                        <TableCell className={cn("text-right tabular-nums", g.overdue > 0 && "font-medium text-chu-red")}>{formatMoney(g.overdue)}</TableCell>
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
          </>
        )
      ) : tab === "payments" ? (
        (payments ?? []).length === 0 ? (
          <EmptyState title="Chưa có thanh toán nào" />
        ) : (
          <>
            <MobileCardList label="Lịch sử thanh toán">
              {(payments ?? []).map((p) => {
                const allocs = (p.supplier_payment_allocations ?? []) as unknown as {
                  amount: number;
                  remaining_before: number;
                  remaining_after: number;
                  supplier_debts: { code: string } | null;
                }[];
                return (
                  <MobileCard
                    key={p.id}
                    title={(p.suppliers as unknown as { name: string } | null)?.name}
                    subtitle={`${p.code} - ${formatDateTime(p.created_at)}`}
                    stats={[
                      { label: "Số tiền", value: formatMoney(p.amount), strong: true },
                      { label: "Ngày", value: formatDateVN(p.payment_date) },
                      {
                        label: "Phương thức",
                        value: `${PAYMENT_METHOD_LABEL[p.method as keyof typeof PAYMENT_METHOD_LABEL]}${p.reference ? ` - ${p.reference}` : ""}`,
                      },
                      {
                        label: "Phân bổ",
                        value:
                          allocs.length === 0
                            ? "Trả ngay khi nhập hàng"
                            : allocs.map((a) => `${a.supplier_debts?.code}: ${formatMoney(a.amount)}`).join(", "),
                      },
                    ]}
                  />
                );
              })}
            </MobileCardList>
            <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
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
          </>
        )
      ) : (
        (() => {
          const rows = tab === "due" ? open.sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999")) : all;
          return rows.length === 0 ? (
            <EmptyState title={tab === "due" ? "Không có khoản nào cần thanh toán" : "Chưa có công nợ"} />
          ) : (
            <DebtBoard
              storeId={store.id}
              storeCode={store.code}
              today={today}
              accounts={(accounts ?? []) as { id: string; name: string; kind: string }[]}
              debts={rows.map((d) => toCard(d, dueStatus(d), today))}
            />
          );
        })()
      )}
    </div>
  );
}

function toCard(d: Debt, due: keyof typeof DUE, today: string): DebtCardData {
  const r = d.purchase_receipts;
  return {
    id: d.id,
    code: d.code,
    supplier_id: d.supplier_id,
    supplier_name: d.suppliers?.name ?? "?",
    receipt_id: d.receipt_id,
    receipt_code: r?.code ?? null,
    issued_date: d.issued_date,
    due_date: d.due_date,
    days_left: d.due_date ? diffDays(today, d.due_date) : null,
    due,
    total_amount: d.total_amount,
    paid_amount: d.paid_amount,
    remaining: d.remaining,
    items: [...(r?.purchase_receipt_items ?? [])]
      .sort((a, b) => a.line_no - b.line_no)
      .map((i) => ({ name: i.products?.name ?? "?", qty: Number(i.qty), unit: i.unit, unit_cost: i.unit_cost, line_total: i.line_total })),
    extra_cost: r?.extra_cost_total ?? 0,
    paid_at_receipt: r?.paid_amount ?? 0,
  };
}
