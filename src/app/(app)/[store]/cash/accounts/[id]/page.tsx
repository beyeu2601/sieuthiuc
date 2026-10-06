import { notFound } from "next/navigation";
import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateVN, presetPeriod } from "@/lib/dates";
import { formatMoney, formatNumber } from "@/lib/format";
import { errorMessage } from "@/lib/errors";
import { PageHeader } from "@/components/page-header";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { FilterBar } from "@/components/filter-bar";
import { EmptyState } from "@/components/empty-state";
import { ChipSac } from "@/components/ui/chip";
import { ChiSo, HangChiSo } from "@/components/ui/chi-so";
import { Khoi } from "@/components/khoi";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HolderSelect } from "./holder-select";

export const metadata = { title: "Sổ tài khoản" };

const SOURCE: Record<string, string> = { sale: "Bán hàng", cash: "Thu chi", supplier: "Trả NCC", preorder: "Cọc đặt trước" };

type Entry = { occurred_on: string; source: string; code: string; description: string; amount: number; balance_after: number };

export default async function AccountLedgerPage({
  params,
  searchParams,
}: {
  params: Promise<{ store: string; id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { store: code, id } = await params;
  const sp = await searchParams;
  const { ctx, store } = await requireStore(code);
  const month = presetPeriod("month");
  const from = sp.from || month.from;
  const to = sp.to || month.to;
  const supabase = await createClient();
  const isManager = ctx.profile.role === "sadmin" || ctx.profile.role === "admin";

  const [{ data: accs }, ledger, { data: users }] = await Promise.all([
    supabase.rpc("money_accounts_overview"),
    supabase.rpc("money_account_ledger", { p_account_id: id, p_from: from, p_to: to }),
    isManager
      ? supabase
          .from("profiles")
          .select("id, full_name, user_stores!inner(store_id)")
          .eq("user_stores.store_id", store.id)
          .eq("is_active", true)
          .order("full_name")
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);
  const acc = ((accs ?? []) as { id: string; name: string; holder_id: string | null; holder_name: string | null; balance: number | null }[]).find(
    (a) => a.id === id
  );
  if (!acc) notFound();
  const rows = (ledger.data ?? []) as Entry[];
  // Tong vao/ra trong ky tinh tu chinh cac dong so dang hien
  const moneyIn = rows.reduce((s, r) => s + (r.amount > 0 ? r.amount : 0), 0);
  const moneyOut = rows.reduce((s, r) => s + (r.amount < 0 ? -r.amount : 0), 0);
  const negative = acc.balance !== null && acc.balance < 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title={acc.name}
        back={{ href: `/${store.code}/cash`, label: "Thu chi" }}
        description={
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {acc.holder_name ? (
              <ChipSac sac="slate">Người giữ: {acc.holder_name}</ChipSac>
            ) : (
              <ChipSac sac="amber" title="Quản lý cửa hàng duyệt các khoản của tài khoản này">
                Chưa có người giữ
              </ChipSac>
            )}
            {negative && <ChipSac sac="red" dam>Số dư âm</ChipSac>}
            <ChipSac sac="slate">
              {formatDateVN(from)} - {formatDateVN(to)}
            </ChipSac>
          </span>
        }
      />

      <HangChiSo>
        {acc.balance !== null && (
          <ChiSo nhan={negative ? "Số dư hiện tại: âm" : "Số dư hiện tại"} sac={negative ? "red" : "brand"} giaTri={formatMoney(acc.balance)} />
        )}
        <ChiSo nhan="Tiền vào trong kỳ" sac={moneyIn > 0 ? "emerald" : "slate"} giaTri={formatMoney(moneyIn)} />
        <ChiSo nhan="Tiền ra trong kỳ" sac={moneyOut > 0 ? "rose" : "slate"} giaTri={formatMoney(moneyOut)} />
        <ChiSo nhan="Số giao dịch" sac="slate" giaTri={formatNumber(rows.length)} phu="Chỉ khoản đã duyệt và đã trả" />
      </HangChiSo>

      <div className={isManager ? "grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_420px]" : ""}>
        <div className="min-w-0 space-y-4">
          {ledger.error ? (
            <p className="rounded-xl border bg-card p-4 text-sm">{errorMessage(ledger.error)}</p>
          ) : (
            <>
              <AutoSubmitForm action={`/${store.code}/cash/accounts/${id}`}>
                <FilterBar>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-[150px_150px] sm:justify-start">
                    <Input type="date" name="from" defaultValue={from} aria-label="Từ ngày" />
                    <Input type="date" name="to" defaultValue={to} aria-label="Đến ngày" />
                  </div>
                </FilterBar>
              </AutoSubmitForm>
              {rows.length === 0 ? (
                <EmptyState title="Không có giao dịch trong khoảng đã chọn" />
              ) : (
                <div className="overflow-x-auto rounded-xl border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ngày</TableHead>
                        <TableHead>Mã</TableHead>
                        <TableHead className="min-w-48">Nội dung</TableHead>
                        <TableHead className="text-right">Số tiền</TableHead>
                        <TableHead className="text-right">Số dư sau</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r, i) => (
                        <TableRow key={`${r.code}-${i}`}>
                          <TableCell className="whitespace-nowrap">{formatDateVN(r.occurred_on)}</TableCell>
                          <TableCell>{r.code}</TableCell>
                          <TableCell>
                            {r.description}
                            <div className="text-xs text-muted-foreground">{SOURCE[r.source] ?? r.source}</div>
                          </TableCell>
                          <TableCell className={`text-right tabular-nums ${r.amount > 0 ? "text-success" : ""}`}>
                            {r.amount > 0 ? "+" : ""}
                            {formatMoney(r.amount)}
                          </TableCell>
                          <TableCell className={`text-right tabular-nums ${r.balance_after < 0 ? "text-chu-red" : ""}`}>
                            {formatMoney(r.balance_after)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </div>

        {isManager && (
          <div className="min-w-0 space-y-4">
            <Khoi title="Người giữ tài khoản">
              <HolderSelect
                storeCode={store.code}
                accountId={acc.id}
                holderId={acc.holder_id}
                users={(users ?? []).map((u) => ({ id: u.id, full_name: u.full_name }))}
              />
            </Khoi>
          </div>
        )}
      </div>
    </div>
  );
}
