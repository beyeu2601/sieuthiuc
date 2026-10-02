import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getNumberSetting } from "@/lib/settings";
import { formatDateTime, formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { ChipSac, type SacNguNghia } from "@/components/ui/chip";
import { ChiSo, HangChiSo } from "@/components/ui/chi-so";
import { Khoi } from "@/components/khoi";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

  const [{ data: summary }, { data: sales }, { data: moves }, { data: waitingCash }, diffAlert] = await Promise.all([
    supabase.rpc("shift_summary", { p_shift_id: id }),
    supabase
      .from("sales")
      .select("id, code, completed_at, total, status, sale_payments(method, amount)")
      .eq("shift_id", id)
      .order("completed_at", { ascending: false }),
    supabase.from("shift_cash_movements").select("id, kind, amount, reason, created_at").eq("shift_id", id).order("created_at"),
    s.status === "open"
      ? supabase
          .from("cash_transactions")
          .select("id, code, kind, description, amount, method")
          .eq("store_id", store.id)
          .eq("created_by", s.user_id)
          .eq("approval_status", "pending")
          .order("created_at")
      : Promise.resolve({ data: [] as { id: string; code: string; kind: string; description: string; amount: number; method: string }[] }),
    // Cung nguong voi close_shift (lech > nguong thi ca can kiem tra)
    getNumberSetting("shift.diff_alert_amount", 50000, store.id),
  ]);
  const sum = summary as ShiftSummary | null;
  const st = SHIFT_STATUS[s.status as keyof typeof SHIFT_STATUS];
  const isManager = ctx.profile.role === "sadmin" || ctx.profile.role === "admin";
  const canClose = s.status === "open" && (s.user_id === ctx.profile.id || isManager);
  const isOpen = s.status === "open";
  const waiting = waitingCash ?? [];
  const moveRows = moves ?? [];
  const saleRows = sales ?? [];
  const staffName = (s.profiles as unknown as { full_name: string } | null)?.full_name;

  const diff = s.cash_diff ?? 0;
  const diffSac: SacNguNghia = isOpen || s.cash_diff == null ? "slate" : Math.abs(diff) > diffAlert ? "red" : diff !== 0 ? "amber" : "emerald";
  const diffLabel = isOpen || s.cash_diff == null ? "Chênh lệch" : Math.abs(diff) > diffAlert ? "Lệch vượt ngưỡng" : diff !== 0 ? "Lệch tiền" : "Khớp tiền";

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Ca ${s.code}`}
        back={{ href: `/${store.code}/shifts`, label: "Danh sách ca" }}
        description={
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <ChipSac sac={st.sac}>{st.label}</ChipSac>
            {staffName && <ChipSac sac="slate">{staffName}</ChipSac>}
            <ChipSac sac="slate">Mở {formatDateTime(s.opened_at)}</ChipSac>
            {s.closed_at && <ChipSac sac="slate">Chốt {formatDateTime(s.closed_at)}</ChipSac>}
            {waiting.length > 0 && <ChipSac sac="amber">{waiting.length} khoản thu chi chờ duyệt</ChipSac>}
          </span>
        }
      />

      <HangChiSo>
        <ChiSo
          nhan="Doanh thu"
          sac="brand"
          giaTri={formatMoney(sum?.revenue ?? 0)}
          phu={`${sum?.sales_count ?? 0} giao dịch${(sum?.cancelled_count ?? 0) > 0 ? ` - ${sum?.cancelled_count} đã hủy` : ""}`}
        />
        <ChiSo nhan="Tiền mặt đầu ca" sac="brand" giaTri={formatMoney(s.opening_cash)} />
        <ChiSo
          nhan="Tiền mặt kỳ vọng"
          sac="brand"
          giaTri={formatMoney(isOpen ? sum?.expected_cash : s.expected_cash)}
          phu={`Thu ${formatMoney(sum?.cash_in ?? 0)} - chi ${formatMoney(sum?.cash_out ?? 0)}`}
        />
        <ChiSo
          nhan={diffLabel}
          sac={diffSac}
          giaTri={isOpen || s.cash_diff == null ? "-" : `${diff > 0 ? "+" : ""}${formatMoney(diff)}`}
          phu={isOpen ? "Chưa chốt ca" : `Thực đếm ${formatMoney(s.counted_cash)} - ngưỡng ${formatMoney(diffAlert)}`}
        />
      </HangChiSo>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-4">
          {canClose && (
            <Khoi title="Chốt ca">
              {waiting.length > 0 && (
                <div role="alert" className="mb-3 rounded-lg border border-vien-amber bg-nen-amber p-3 text-sm">
                  <p className="font-medium text-chu-amber">Tiền mặt kỳ vọng chưa tính {waiting.length} khoản chờ duyệt (vẫn chốt được):</p>
                  <ul className="mt-1 list-disc pl-5">
                    {waiting.map((w) => (
                      <li key={w.id}>
                        {w.code} - {w.kind === "income" ? "Thu" : "Chi"} {formatMoney(w.amount)} ({PAYMENT_METHOD_LABEL[w.method as keyof typeof PAYMENT_METHOD_LABEL]}): {w.description}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <CloseShiftForm
                storeCode={store.code}
                shiftId={s.id}
                expected={sum?.expected_cash ?? 0}
                waitingCount={waiting.length}
                diffAlert={diffAlert}
              />
            </Khoi>
          )}

          {!isOpen && (s.close_note || s.review_note || isManager) && (
            <Khoi title="Kiểm tra ca">
              <div className="space-y-3 text-sm">
                {(s.close_note || s.review_note) && (
                  <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
                    {s.close_note && (
                      <>
                        <dt className="text-muted-foreground">Ghi chú chốt ca</dt>
                        <dd>{s.close_note}</dd>
                      </>
                    )}
                    {s.review_note && (
                      <>
                        <dt className="text-muted-foreground">Ghi chú quản lý</dt>
                        <dd>{s.review_note}</dd>
                      </>
                    )}
                  </dl>
                )}
                {isManager && (s.status === "closed" || s.status === "flagged") && <ApproveShiftForm storeCode={store.code} shiftId={s.id} />}
                {isManager && <AdjustCountForm storeCode={store.code} shiftId={s.id} current={s.counted_cash ?? 0} />}
              </div>
            </Khoi>
          )}

          <section className="rounded-xl border bg-card p-4">
            <Tabs defaultValue="sales">
              <TabsList>
                <TabsTrigger value="sales" className="px-3">
                  Giao dịch ({saleRows.length})
                </TabsTrigger>
                <TabsTrigger value="moves" className="px-3">
                  Thu chi trong ca ({moveRows.length})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="sales" className="pt-2">
                {saleRows.length === 0 ? (
                  <p className="py-4 text-muted-foreground">Chưa có giao dịch.</p>
                ) : (
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
                        {saleRows.map((x) => (
                          <TableRow key={x.id}>
                            <TableCell>
                              <Link href={`/${store.code}/sales/${x.id}`} className="font-medium hover:underline">
                                {x.code}
                              </Link>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">{formatDateTime(x.completed_at)}</TableCell>
                            <TableCell>
                              {(x.sale_payments as { method: keyof typeof PAYMENT_METHOD_LABEL; amount: number }[])
                                .map((p) => PAYMENT_METHOD_LABEL[p.method])
                                .join(", ")}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{formatMoney(x.total)}</TableCell>
                            <TableCell>
                              {x.status === "cancelled" ? <ChipSac sac="red">Đã hủy</ChipSac> : <ChipSac sac="emerald">Hoàn tất</ChipSac>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="moves" className="pt-2">
                {moveRows.length === 0 ? (
                  <p className="py-4 text-muted-foreground">Chưa có khoản thu chi tiền mặt trong ca.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Thời gian</TableHead>
                          <TableHead>Loại</TableHead>
                          <TableHead className="text-right">Số tiền</TableHead>
                          <TableHead>Lý do</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {moveRows.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(m.created_at)}</TableCell>
                            <TableCell>
                              <ChipSac sac={m.kind === "income" ? "emerald" : "rose"}>{m.kind === "income" ? "Thu" : "Chi"}</ChipSac>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{formatMoney(m.amount)}</TableCell>
                            <TableCell>{m.reason}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </section>
        </div>

        <div className="min-w-0 space-y-4">
          <Khoi title="Theo phương thức">
            <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-y-1.5 text-sm">
              {(["cash", "transfer", "other"] as const).map((m) => (
                <div key={m} className="contents">
                  <dt className="text-muted-foreground">{PAYMENT_METHOD_LABEL[m]}</dt>
                  <dd className="text-right font-medium tabular-nums">{formatMoney(sum?.by_method?.[m] ?? 0)}</dd>
                </div>
              ))}
              <dt className="border-t pt-1.5 text-muted-foreground">Thu trong ca</dt>
              <dd className="border-t pt-1.5 text-right font-medium tabular-nums">{formatMoney(sum?.cash_in ?? 0)}</dd>
              <dt className="text-muted-foreground">Chi trong ca</dt>
              <dd className="text-right font-medium tabular-nums">{formatMoney(sum?.cash_out ?? 0)}</dd>
            </dl>
          </Khoi>
        </div>
      </div>
    </div>
  );
}
