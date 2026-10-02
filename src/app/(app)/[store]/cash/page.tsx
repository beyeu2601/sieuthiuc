import Link from "next/link";
import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateVN, presetPeriod } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { FilterBar } from "@/components/filter-bar";
import { EmptyState } from "@/components/empty-state";
import { LuaChon } from "@/components/lua-chon";
import { ChipSac } from "@/components/ui/chip";
import { ChiSo, HangChiSo } from "@/components/ui/chi-so";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAYMENT_METHOD_LABEL } from "../receipts/labels";
import { MobileCard, MobileCardList } from "@/components/mobile-card";
import { CashRowActions } from "./row-actions";

export const metadata = { title: "Thu chi" };

const APPROVAL = {
  pending: { label: "Chờ duyệt", sac: "amber" },
  approved: { label: "Đã duyệt", sac: "emerald" },
  rejected: { label: "Từ chối", sac: "red" },
} as const;

type AccountOverview = { id: string; name: string; kind: string; holder_id: string | null; holder_name: string | null; balance: number | null };

type SP = { from?: string; to?: string; kind?: string; cat?: string; approval?: string; pay?: string };

export default async function CashPage({ params, searchParams }: { params: Promise<{ store: string }>; searchParams: Promise<SP> }) {
  const { store: code } = await params;
  const sp = await searchParams;
  const { ctx, store } = await requireStore(code);
  const month = presetPeriod("month");
  const from = sp.from || month.from;
  const to = sp.to || month.to;
  const supabase = await createClient();
  const [{ data: cats }, { data: accData }, { data: waiting }] = await Promise.all([
    supabase.from("expense_categories").select("id, name, kind").eq("is_active", true).order("kind").order("name"),
    supabase.rpc("money_accounts_overview"),
    supabase
      .from("cash_transactions")
      .select("id, account_id")
      .eq("store_id", store.id)
      .or("approval_status.eq.pending,pending_action.not.is.null"),
  ]);
  const accounts = (accData ?? []) as AccountOverview[];
  const accById = new Map(accounts.map((a) => [a.id, a]));
  const isManager = ctx.profile.role === "sadmin" || ctx.profile.role === "admin";
  const canFinance = ctx.profile.role !== "staff";
  // Nguoi giu tai khoan duyet; tai khoan chua co nguoi giu thi quan ly cua hang duyet
  const canApprove = (accountId: string | null) => {
    const holder = accountId ? accById.get(accountId)?.holder_id : null;
    return holder ? holder === ctx.profile.id : isManager;
  };
  const waitingMine = (waiting ?? []).filter((w) => canApprove(w.account_id)).length;
  let q = supabase
    .from("cash_transactions")
    .select("id, code, kind, occurred_on, description, amount, method, counterparty, doc_no, payment_status, paid_on, approval_status, reject_reason, shift_id, account_id, created_by, payout_id, pending_action, pending_data, pending_reason, expense_categories(name), creator:created_by(full_name)")
    .eq("store_id", store.id)
    .gte("occurred_on", from)
    .lte("occurred_on", to)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);
  if (sp.kind === "income" || sp.kind === "expense") q = q.eq("kind", sp.kind);
  if (sp.cat) q = q.eq("category_id", sp.cat);
  if (sp.approval === "waiting") q = q.or("approval_status.eq.pending,pending_action.not.is.null");
  else if (sp.approval && sp.approval in APPROVAL) q = q.eq("approval_status", sp.approval);
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

  return (
    <div className="space-y-4">
      <PageHeader
        title="Thu chi"
        actions={<Button render={<Link href={`/${store.code}/cash/new`} />}>Xin chi / báo thu</Button>}
      />

      {waitingMine > 0 && (
        <Link
          href={`/${store.code}/cash?approval=waiting&from=2000-01-01`}
          className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-vien-amber bg-nen-amber px-4 py-2 text-sm font-medium text-chu-amber"
        >
          <span>{waitingMine} khoản đang chờ bạn duyệt</span>
          <span aria-hidden>Xem -&gt;</span>
        </Link>
      )}

      {accounts.length > 0 && (
        <section aria-label="Tài khoản giữ tiền" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {accounts.map((a) => (
            <Link
              key={a.id}
              href={`/${store.code}/cash/accounts/${a.id}`}
              className="rounded-xl border bg-card px-4 py-3 transition-colors hover:bg-muted"
            >
              <div className="font-medium">{a.name}</div>
              <div className={a.holder_name ? "text-xs text-muted-foreground" : "text-xs text-chu-amber"}>
                {a.holder_name ? `Người giữ: ${a.holder_name}` : "Chưa có người giữ"}
              </div>
              {a.balance !== null && (
                <div className={`mt-1 text-xl font-semibold tabular-nums ${a.balance < 0 ? "text-chu-red" : ""}`}>{formatMoney(a.balance)}</div>
              )}
            </Link>
          ))}
        </section>
      )}
      <AutoSubmitForm action={`/${store.code}/cash`}>
        <FilterBar>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-[150px_150px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <Input type="date" name="from" defaultValue={from} aria-label="Từ ngày" />
            <Input type="date" name="to" defaultValue={to} aria-label="Đến ngày" />
            <LuaChon
              name="kind"
              defaultValue={sp.kind ?? ""}
              aria-label="Loại"
              options={[
                { value: "", label: "Thu và chi" },
                { value: "expense", label: "Chi" },
                { value: "income", label: "Thu" },
              ]}
            />
            <LuaChon
              name="cat"
              defaultValue={sp.cat ?? ""}
              aria-label="Nhóm"
              options={[{ value: "", label: "Mọi nhóm" }, ...(cats ?? []).map((c) => ({ value: c.id, label: `${c.kind === "income" ? "Thu: " : ""}${c.name}` }))]}
            />
            <LuaChon
              name="approval"
              defaultValue={sp.approval ?? ""}
              aria-label="Duyệt"
              options={[
                { value: "", label: "Mọi trạng thái" },
                { value: "waiting", label: "Chờ duyệt (mới, sửa, xóa)" },
                { value: "pending", label: "Chờ duyệt khoản mới" },
                { value: "approved", label: "Đã duyệt" },
                { value: "rejected", label: "Từ chối" },
              ]}
            />
            <LuaChon
              name="pay"
              defaultValue={sp.pay ?? ""}
              aria-label="Thanh toán"
              options={[
                { value: "", label: "Tất cả" },
                { value: "unpaid", label: "Chưa trả" },
                { value: "paid", label: "Đã trả" },
              ]}
            />
          </div>
        </FilterBar>
      </AutoSubmitForm>

      {canFinance && (
        <HangChiSo>
          <ChiSo nhan="Tổng chi (đã duyệt)" sac={totalExp > 0 ? "rose" : "slate"} giaTri={formatMoney(totalExp)} />
          <ChiSo nhan="Tổng thu khác (đã duyệt)" sac={totalInc > 0 ? "emerald" : "slate"} giaTri={formatMoney(totalInc)} />
          <div className="col-span-2 rounded-xl border bg-card px-4 py-3 text-sm">
            <div className="mb-1 font-medium text-muted-foreground">Chi theo nhóm</div>
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
        </HangChiSo>
      )}

      {rows.length === 0 ? (
        <EmptyState title="Không có khoản thu chi trong khoảng đã chọn" />
      ) : (
        <>
          <MobileCardList label="Thu chi">
            {rows.map((r) => {
              const ap = APPROVAL[r.approval_status as keyof typeof APPROVAL];
              const change = r.pending_data as { amount?: number; description?: string } | null;
              const canReview = (r.approval_status === "pending" || r.pending_action !== null) && canApprove(r.account_id);
              const canMarkPaid = canFinance && r.payment_status === "unpaid" && r.approval_status !== "rejected";
              const canRequest =
                r.approval_status === "approved" && !r.pending_action && !r.payout_id && (r.created_by === ctx.profile.id || isManager);
              const hasFooter = r.reject_reason || r.pending_action || canReview || canMarkPaid || canRequest;
              return (
                <MobileCard
                  key={r.id}
                  title={r.description}
                  subtitle={[formatDateVN(r.occurred_on), r.code, (r.creator as unknown as { full_name: string } | null)?.full_name]
                    .filter(Boolean)
                    .join(" - ")}
                  badge={
                    r.pending_action ? (
                      <ChipSac sac="amber">Chờ duyệt {r.pending_action === "edit" ? "sửa" : "xóa"}</ChipSac>
                    ) : (
                      <ChipSac sac={ap.sac}>{ap.label}</ChipSac>
                    )
                  }
                  stats={[
                    {
                      label: "Số tiền",
                      value: (
                        <span className={r.kind === "income" ? "text-success" : ""}>
                          {r.kind === "income" ? "+" : "-"}
                          {formatMoney(r.amount)}
                        </span>
                      ),
                      strong: true,
                    },
                    { label: "Tài khoản", value: (r.account_id && accById.get(r.account_id)?.name) || "-" },
                    {
                      label: "Thanh toán",
                      value: r.payment_status === "paid" ? `Đã trả ${formatDateVN(r.paid_on)}` : <span className="text-chu-red">Chưa trả</span>,
                    },
                  ]}
                  footer={
                    hasFooter && (
                    <div className="space-y-2">
                      {r.reject_reason && (
                        <div className="text-xs text-destructive">
                          {r.approval_status === "rejected" ? "Từ chối: " : ""}
                          {r.reject_reason}
                        </div>
                      )}
                      {r.pending_action && (
                        <div className="text-xs text-warning">
                          Xin {r.pending_action === "edit" ? "sửa" : "xóa"}: {r.pending_reason}
                          {change?.amount !== undefined && change.amount !== r.amount && ` - số tiền mới ${formatMoney(change.amount)}`}
                          {change?.description && change.description !== r.description && ` - nội dung mới "${change.description}"`}
                        </div>
                      )}
                      <CashRowActions storeCode={store.code} id={r.id} canReview={canReview} canMarkPaid={canMarkPaid} canRequest={canRequest} />
                    </div>
                    )
                  }
                />
              );
            })}
          </MobileCardList>
          <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ngày</TableHead>
                  <TableHead>Mã</TableHead>
                  <TableHead className="min-w-48">Nội dung</TableHead>
                  <TableHead>Nhóm</TableHead>
                  <TableHead>Tài khoản</TableHead>
                  <TableHead className="text-right">Số tiền</TableHead>
                  <TableHead>Thanh toán</TableHead>
                  <TableHead>Duyệt</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const ap = APPROVAL[r.approval_status as keyof typeof APPROVAL];
                  const change = r.pending_data as { amount?: number; description?: string } | null;
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
                        {r.reject_reason && (
                          <div className="text-xs text-destructive">
                            {r.approval_status === "rejected" ? "Từ chối: " : ""}
                            {r.reject_reason}
                          </div>
                        )}
                        {r.pending_action && (
                          <div className="text-xs text-warning">
                            Xin {r.pending_action === "edit" ? "sửa" : "xóa"}: {r.pending_reason}
                            {change?.amount !== undefined && change.amount !== r.amount && ` - số tiền mới ${formatMoney(change.amount)}`}
                            {change?.description && change.description !== r.description && ` - nội dung mới "${change.description}"`}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{(r.expense_categories as unknown as { name: string } | null)?.name}</TableCell>
                      <TableCell>
                        {(r.account_id && accById.get(r.account_id)?.name) || "-"}
                        <div className="text-xs text-muted-foreground">{PAYMENT_METHOD_LABEL[r.method as keyof typeof PAYMENT_METHOD_LABEL]}</div>
                      </TableCell>
                      <TableCell className={`text-right tabular-nums ${r.kind === "income" ? "text-success" : ""}`}>
                        {r.kind === "income" ? "+" : "-"}
                        {formatMoney(r.amount)}
                      </TableCell>
                      <TableCell>
                        {r.payment_status === "paid" ? (
                          <span className="whitespace-nowrap text-muted-foreground">Đã trả {formatDateVN(r.paid_on)}</span>
                        ) : (
                          <ChipSac sac="red" title="Phải trả khác">
                            Chưa trả
                          </ChipSac>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.pending_action ? (
                          <ChipSac sac="amber">Chờ duyệt {r.pending_action === "edit" ? "sửa" : "xóa"}</ChipSac>
                        ) : (
                          <ChipSac sac={ap.sac}>{ap.label}</ChipSac>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <CashRowActions
                          storeCode={store.code}
                          id={r.id}
                          canReview={(r.approval_status === "pending" || r.pending_action !== null) && canApprove(r.account_id)}
                          canMarkPaid={canFinance && r.payment_status === "unpaid" && r.approval_status !== "rejected"}
                          canRequest={
                            r.approval_status === "approved" &&
                            !r.pending_action &&
                            !r.payout_id &&
                            (r.created_by === ctx.profile.id || isManager)
                          }
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
