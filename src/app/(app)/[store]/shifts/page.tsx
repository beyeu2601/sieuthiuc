import Link from "next/link";
import { hasPerm, requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getNumberSetting } from "@/lib/settings";
import { formatDateTime, formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { FilterBar } from "@/components/filter-bar";
import { EmptyState } from "@/components/empty-state";
import { ChipSac } from "@/components/ui/chip";
import { MobileCard, MobileCardList } from "@/components/mobile-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SHIFT_STATUS } from "./labels";
import { OpenShiftForm } from "./shift-forms";

export const metadata = { title: "Ca làm việc" };

export default async function ShiftsPage({
  params,
  searchParams,
}: {
  params: Promise<{ store: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { store: code } = await params;
  const sp = await searchParams;
  const { ctx, store } = await requireStore(code);
  const supabase = await createClient();
  const canWork = ctx.profile.role !== "accountant";
  const canOpen = ctx.profile.role === "sadmin" || hasPerm(ctx, "open_shift");

  const { data: myOpen } = await supabase
    .from("shifts")
    .select("id, code, opened_at, profiles:user_id(full_name)")
    .eq("store_id", store.id)
    .eq("status", "open")
    .maybeSingle();

  let q = supabase
    .from("shifts")
    .select("id, code, status, opened_at, closed_at, opening_cash, expected_cash, counted_cash, cash_diff, profiles:user_id(full_name)")
    .eq("store_id", store.id)
    .order("opened_at", { ascending: false })
    .limit(200);
  if (sp.from) q = q.gte("opened_at", `${sp.from}T00:00:00+07:00`);
  if (sp.to) q = q.lte("opened_at", `${sp.to}T23:59:59+07:00`);
  const [{ data }, diffAlert] = await Promise.all([q, getNumberSetting("shift.diff_alert_amount", 50000, store.id)]);
  const rows = data ?? [];
  // Cung nguong voi close_shift: vuot nguong do, lech nho vang
  const diffClass = (d: number) => (Math.abs(d) > diffAlert ? "text-chu-red" : d !== 0 ? "text-chu-amber" : "");

  return (
    <div className="space-y-4">
      <PageHeader title="Ca làm việc" />

      {canWork && (
        <section className="rounded-xl border bg-card p-4">
          {myOpen ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p>
                Ca <strong>{myOpen.code}</strong> của {(myOpen.profiles as unknown as { full_name: string } | null)?.full_name ?? "-"} đang
                mở từ {formatDateTime(myOpen.opened_at)}.
              </p>
              <div className="flex gap-2">
                <Button render={<Link href={`/${store.code}/pos`} />}>Bán hàng</Button>
                <Button variant="outline" render={<Link href={`/${store.code}/shifts/${myOpen.id}`} />}>
                  Xem / chốt ca
                </Button>
              </div>
            </div>
          ) : canOpen ? (
            <OpenShiftForm storeCode={store.code} storeId={store.id} redirectTo={`/${store.code}/pos`} />
          ) : (
            <p className="text-sm text-muted-foreground">Chưa mở ca. Nhờ người được cấp quyền mở ca.</p>
          )}
        </section>
      )}

      <AutoSubmitForm action={`/${store.code}/shifts`}>
        <FilterBar>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-end">
            <label className="block min-w-0 space-y-1 text-sm">
              Từ ngày
              <Input type="date" name="from" defaultValue={sp.from} className="min-w-0" />
            </label>
            <label className="block min-w-0 space-y-1 text-sm">
              Đến ngày
              <Input type="date" name="to" defaultValue={sp.to} className="min-w-0" />
            </label>
          </div>
        </FilterBar>
      </AutoSubmitForm>

      {rows.length === 0 ? (
        <EmptyState title="Chưa có ca nào" />
      ) : (
        <>
          <MobileCardList label="Ca làm việc">
            {rows.map((s) => {
              const st = SHIFT_STATUS[s.status as keyof typeof SHIFT_STATUS];
              const diff = s.cash_diff ?? 0;
              return (
                <MobileCard
                  key={s.id}
                  title={
                    <Link href={`/${store.code}/shifts/${s.id}`} className="underline-offset-4 hover:underline">
                      {s.code}
                    </Link>
                  }
                  subtitle={`${formatDateTime(s.opened_at)} - ${(s.profiles as unknown as { full_name: string } | null)?.full_name ?? "-"}`}
                  badge={<ChipSac sac={st.sac}>{st.label}</ChipSac>}
                  stats={[
                    { label: "Kỳ vọng", value: formatMoney(s.expected_cash), strong: true },
                    { label: "Thực đếm", value: formatMoney(s.counted_cash) },
                    {
                      label: "Lệch",
                      value: <span className={diffClass(diff)}>{s.cash_diff == null ? "-" : formatMoney(diff)}</span>,
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
                  <TableHead>Ca</TableHead>
                  <TableHead>Nhân viên</TableHead>
                  <TableHead>Mở</TableHead>
                  <TableHead>Chốt</TableHead>
                  <TableHead className="text-right">Đầu ca</TableHead>
                  <TableHead className="text-right">Kỳ vọng</TableHead>
                  <TableHead className="text-right">Thực đếm</TableHead>
                  <TableHead className="text-right">Lệch</TableHead>
                  <TableHead>Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => {
                  const st = SHIFT_STATUS[s.status as keyof typeof SHIFT_STATUS];
                  const diff = s.cash_diff ?? 0;
                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        <Link href={`/${store.code}/shifts/${s.id}`} className="font-medium hover:underline">
                          {s.code}
                        </Link>
                      </TableCell>
                      <TableCell>{(s.profiles as unknown as { full_name: string } | null)?.full_name ?? "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDateTime(s.opened_at)}</TableCell>
                      <TableCell className="whitespace-nowrap">{s.closed_at ? formatDateTime(s.closed_at) : "-"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(s.opening_cash)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(s.expected_cash)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(s.counted_cash)}</TableCell>
                      <TableCell className={`text-right tabular-nums ${diffClass(diff)}`}>
                        {s.cash_diff == null ? "-" : formatMoney(diff)}
                      </TableCell>
                      <TableCell>
                        <ChipSac sac={st.sac}>{st.label}</ChipSac>
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
