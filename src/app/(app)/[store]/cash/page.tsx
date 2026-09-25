import Link from "next/link";
import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateVN, presetPeriod } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { NativeSelect } from "@/components/native-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAYMENT_METHOD_LABEL } from "../receipts/labels";
import { CashRowActions } from "./row-actions";

export const metadata = { title: "Thu chi" };

const APPROVAL = {
  pending: { label: "Chờ duyệt", variant: "default" },
  approved: { label: "Đã duyệt", variant: "secondary" },
  rejected: { label: "Từ chối", variant: "destructive" },
} as const;

type SP = { from?: string; to?: string; kind?: string; cat?: string; approval?: string; pay?: string };

export default async function CashPage({ params, searchParams }: { params: Promise<{ store: string }>; searchParams: Promise<SP> }) {
  const { store: code } = await params;
  const sp = await searchParams;
  const { ctx, store } = await requireStore(code);
  const month = presetPeriod("month");
  const from = sp.from || month.from;
  const to = sp.to || month.to;
  const supabase = await createClient();
  const { data: cats } = await supabase.from("expense_categories").select("id, name, kind").eq("is_active", true).order("kind").order("name");
  let q = supabase
    .from("cash_transactions")
    .select("id, code, kind, occurred_on, description, amount, method, counterparty, doc_no, payment_status, paid_on, approval_status, reject_reason, shift_id, expense_categories(name), creator:created_by(full_name)")
    .eq("store_id", store.id)
    .gte("occurred_on", from)
    .lte("occurred_on", to)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);
  if (sp.kind === "income" || sp.kind === "expense") q = q.eq("kind", sp.kind);
  if (sp.cat) q = q.eq("category_id", sp.cat);
  if (sp.approval && sp.approval in APPROVAL) q = q.eq("approval_status", sp.approval);
  if (sp.pay === "paid" || sp.pay === "unpaid") q = q.eq("payment_status", sp.pay);
  const { data } = await q;
  const rows = data ?? [];
  const approved = rows.filter((r) => r.approval_status === "approved");
  const totalExp = approved.filter((r) => r.kind === "expense").reduce((s, r) => s + r.amount, 0);
  const totalInc = approved.filter((r) => r.kind === "income").reduce((s, r) => s + r.amount, 0);
  const byCat = new Map<string, number>();
  for (const r of approved.filter((x) => x.kind === "expense")) {
    const n = (r.expense_categories as unknown as { name: string } | null)?.name ?? "?";
    byCat.set(n, (byCat.get(n) ?? 0) + r.amount);
  }
  const isManager = ctx.profile.role === "sadmin" || ctx.profile.role === "admin";
  const canFinance = ctx.profile.role !== "staff";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Thu chi"
        description="Chi phí ghi theo ngày phát sinh. Khoản chưa trả vẫn tính vào lãi lỗ và theo dõi ở mục Phải trả khác."
        actions={<Button render={<Link href={`/${store.code}/cash/new`} />}>Ghi thu chi</Button>}
      />
      <form className="grid gap-2 sm:grid-cols-[150px_150px_120px_180px_140px_140px_auto]">
        <Input type="date" name="from" defaultValue={from} aria-label="Từ ngày" />
        <Input type="date" name="to" defaultValue={to} aria-label="Đến ngày" />
        <NativeSelect name="kind" defaultValue={sp.kind ?? ""} aria-label="Loại">
          <option value="">Thu và chi</option>
          <option value="expense">Chi</option>
          <option value="income">Thu</option>
        </NativeSelect>
        <NativeSelect name="cat" defaultValue={sp.cat ?? ""} aria-label="Nhóm">
          <option value="">Mọi nhóm</option>
          {(cats ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.kind === "income" ? "Thu: " : ""}
              {c.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="approval" defaultValue={sp.approval ?? ""} aria-label="Duyệt">
          <option value="">Mọi trạng thái</option>
          <option value="pending">Chờ duyệt</option>
          <option value="approved">Đã duyệt</option>
          <option value="rejected">Từ chối</option>
        </NativeSelect>
        <NativeSelect name="pay" defaultValue={sp.pay ?? ""} aria-label="Thanh toán">
          <option value="">Đã / chưa trả</option>
          <option value="unpaid">Phải trả khác (chưa trả)</option>
          <option value="paid">Đã trả</option>
        </NativeSelect>
        <Button type="submit" variant="secondary">
          Lọc
        </Button>
      </form>

      {canFinance && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-4">
            <div className="text-sm text-muted-foreground">Tổng chi (đã duyệt)</div>
            <div className="text-xl font-semibold tabular-nums">{formatMoney(totalExp)}</div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="text-sm text-muted-foreground">Tổng thu khác (đã duyệt)</div>
            <div className="text-xl font-semibold tabular-nums">{formatMoney(totalInc)}</div>
          </div>
          <div className="rounded-xl border bg-card p-4 text-sm">
            <div className="mb-1 text-muted-foreground">Chi theo nhóm</div>
            {[...byCat.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([n, v]) => (
                <div key={n} className="flex justify-between">
                  <span>{n}</span>
                  <span className="tabular-nums">{formatMoney(v)}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState title="Không có khoản thu chi trong khoảng đã chọn" />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ngày</TableHead>
                <TableHead>Mã</TableHead>
                <TableHead className="min-w-48">Nội dung</TableHead>
                <TableHead>Nhóm</TableHead>
                <TableHead>Phương thức</TableHead>
                <TableHead className="text-right">Số tiền</TableHead>
                <TableHead>Thanh toán</TableHead>
                <TableHead>Duyệt</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const ap = APPROVAL[r.approval_status as keyof typeof APPROVAL];
                return (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{formatDateVN(r.occurred_on)}</TableCell>
                    <TableCell>{r.code}</TableCell>
                    <TableCell>
                      {r.description}
                      <div className="text-xs text-muted-foreground">
                        {[r.counterparty, r.doc_no && `CT ${r.doc_no}`, (r.creator as unknown as { full_name: string } | null)?.full_name, r.shift_id && "trong ca"]
                          .filter(Boolean)
                          .join(" - ")}
                      </div>
                      {r.reject_reason && <div className="text-xs text-destructive">Từ chối: {r.reject_reason}</div>}
                    </TableCell>
                    <TableCell>{(r.expense_categories as unknown as { name: string } | null)?.name}</TableCell>
                    <TableCell>{PAYMENT_METHOD_LABEL[r.method as keyof typeof PAYMENT_METHOD_LABEL]}</TableCell>
                    <TableCell className={`text-right tabular-nums ${r.kind === "income" ? "text-success" : ""}`}>
                      {r.kind === "income" ? "+" : "-"}
                      {formatMoney(r.amount)}
                    </TableCell>
                    <TableCell>{r.payment_status === "paid" ? `Đã trả ${formatDateVN(r.paid_on)}` : <Badge variant="outline">Chưa trả</Badge>}</TableCell>
                    <TableCell>
                      <Badge variant={ap.variant}>{ap.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <CashRowActions
                        storeCode={store.code}
                        id={r.id}
                        canReview={isManager && r.approval_status === "pending"}
                        canMarkPaid={canFinance && r.payment_status === "unpaid" && r.approval_status !== "rejected"}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
