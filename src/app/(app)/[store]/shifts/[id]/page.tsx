import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SHIFT_STATUS, type ShiftSummary } from "../labels";
import { AdjustCountForm, ApproveShiftForm, CloseShiftForm } from "../shift-forms";
import { PAYMENT_METHOD_LABEL } from "../../receipts/labels";

export default async function ShiftPage({ params }: { params: Promise<{ store: string; id: string }> }) {
  const { store: code, id } = await params;
  const { ctx, store } = await requireStore(code);
  const supabase = await createClient();
  const { data: s } = await supabase
    .from("shifts")
    .select("id, code, user_id, status, opened_at, closed_at, opening_cash, expected_cash, counted_cash, cash_diff, close_note, review_note, approved_at, profiles:user_id(full_name)")
    .eq("id", id)
    .eq("store_id", store.id)
    .maybeSingle();
  if (!s) notFound();

  const [{ data: summary }, { data: sales }, { data: moves }] = await Promise.all([
    supabase.rpc("shift_summary", { p_shift_id: id }),
    supabase
      .from("sales")
      .select("id, code, completed_at, total, status, sale_payments(method, amount)")
      .eq("shift_id", id)
      .order("completed_at", { ascending: false }),
    supabase.from("shift_cash_movements").select("id, kind, amount, reason, created_at").eq("shift_id", id).order("created_at"),
  ]);
  const sum = summary as ShiftSummary | null;
  const st = SHIFT_STATUS[s.status as keyof typeof SHIFT_STATUS];
  const isManager = ctx.profile.role === "sadmin" || ctx.profile.role === "admin";
  const canClose = s.status === "open" && (s.user_id === ctx.profile.id || isManager);

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Ca ${s.code}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant={st.variant}>{st.label}</Badge>
            {(s.profiles as unknown as { full_name: string } | null)?.full_name} - mở {formatDateTime(s.opened_at)}
            {s.closed_at ? ` - chốt ${formatDateTime(s.closed_at)}` : ""}
          </span>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Số giao dịch", value: String(sum?.sales_count ?? 0) },
          { label: "Doanh thu", value: formatMoney(sum?.revenue ?? 0) },
          { label: "Tiền mặt đầu ca", value: formatMoney(s.opening_cash) },
          { label: "Tiền mặt kỳ vọng", value: formatMoney(s.status === "open" ? sum?.expected_cash : s.expected_cash) },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border bg-background p-4">
            <div className="text-sm text-muted-foreground">{c.label}</div>
            <div className="text-xl font-semibold tabular-nums">{c.value}</div>
          </div>
        ))}
      </div>

      <section className="rounded-xl border bg-background p-4 text-sm">
        <h2 className="mb-2 font-medium">Theo phương thức</h2>
        <ul className="flex flex-wrap gap-4">
          {(["cash", "transfer", "other"] as const).map((m) => (
            <li key={m}>
              {PAYMENT_METHOD_LABEL[m]}: <strong className="tabular-nums">{formatMoney(sum?.by_method?.[m] ?? 0)}</strong>
            </li>
          ))}
          <li>
            Thu trong ca: <strong className="tabular-nums">{formatMoney(sum?.cash_in ?? 0)}</strong>
          </li>
          <li>
            Chi trong ca: <strong className="tabular-nums">{formatMoney(sum?.cash_out ?? 0)}</strong>
          </li>
          {(sum?.cancelled_count ?? 0) > 0 && <li>Giao dịch đã hủy: {sum?.cancelled_count}</li>}
        </ul>
        {(moves ?? []).length > 0 && (
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {(moves ?? []).map((m) => (
              <li key={m.id}>
                {formatDateTime(m.created_at)} - {m.kind === "income" ? "Thu" : "Chi"} {formatMoney(m.amount)}: {m.reason}
              </li>
            ))}
          </ul>
        )}
      </section>

      {canClose && (
        <section className="rounded-xl border bg-background p-4">
          <h2 className="mb-3 font-medium">Chốt ca</h2>
          <CloseShiftForm storeCode={store.code} shiftId={s.id} expected={sum?.expected_cash ?? 0} />
        </section>
      )}

      {s.status !== "open" && (
        <section className="space-y-2 rounded-xl border bg-background p-4 text-sm">
          <h2 className="font-medium">Kết quả chốt ca</h2>
          <p>
            Kỳ vọng {formatMoney(s.expected_cash)} - thực đếm {formatMoney(s.counted_cash)} - lệch{" "}
            <strong className={(s.cash_diff ?? 0) < 0 ? "text-red-700" : ""}>{formatMoney(s.cash_diff)}</strong>
          </p>
          {s.close_note && <p>Ghi chú chốt ca: {s.close_note}</p>}
          {s.review_note && <p>Ghi chú quản lý: {s.review_note}</p>}
          {isManager && (s.status === "closed" || s.status === "flagged") && (
            <ApproveShiftForm storeCode={store.code} shiftId={s.id} />
          )}
          {isManager && <AdjustCountForm storeCode={store.code} shiftId={s.id} current={s.counted_cash ?? 0} />}
        </section>
      )}

      <section className="rounded-xl border bg-background">
        <h2 className="p-4 pb-0 font-medium">Giao dịch trong ca</h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã</TableHead>
                <TableHead>Thời gian</TableHead>
                <TableHead>Thanh toán</TableHead>
                <TableHead className="text-right">Tổng</TableHead>
                <TableHead>Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(sales ?? []).map((x) => (
                <TableRow key={x.id}>
                  <TableCell>
                    <Link href={`/${store.code}/sales/${x.id}`} className="font-medium hover:underline">
                      {x.code}
                    </Link>
                  </TableCell>
                  <TableCell>{formatDateTime(x.completed_at)}</TableCell>
                  <TableCell>
                    {(x.sale_payments as { method: keyof typeof PAYMENT_METHOD_LABEL; amount: number }[])
                      .map((p) => PAYMENT_METHOD_LABEL[p.method])
                      .join(", ")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(x.total)}</TableCell>
                  <TableCell>{x.status === "cancelled" ? <Badge variant="destructive">Đã hủy</Badge> : "Hoàn tất"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
