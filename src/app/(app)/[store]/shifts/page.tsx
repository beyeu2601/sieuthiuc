import Link from "next/link";
import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
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

  const { data: myOpen } = await supabase
    .from("shifts")
    .select("id, code, opened_at")
    .eq("store_id", store.id)
    .eq("user_id", ctx.profile.id)
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
  const { data } = await q;
  const rows = data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader title="Ca làm việc" description="Mở ca trước khi bán hàng. Chốt ca để đối chiếu tiền mặt trong két." />

      {canWork && (
        <section className="rounded-xl border bg-background p-4">
          {myOpen ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p>
                Bạn đang mở ca <strong>{myOpen.code}</strong> từ {formatDateTime(myOpen.opened_at)}.
              </p>
              <div className="flex gap-2">
                <Button render={<Link href={`/${store.code}/pos`} />}>Bán hàng</Button>
                <Button variant="outline" render={<Link href={`/${store.code}/shifts/${myOpen.id}`} />}>
                  Xem / chốt ca
                </Button>
              </div>
            </div>
          ) : (
            <OpenShiftForm storeCode={store.code} storeId={store.id} redirectTo={`/${store.code}/pos`} />
          )}
        </section>
      )}

      <form className="flex flex-wrap items-end gap-2">
        <label className="space-y-1 text-sm">
          Từ ngày
          <Input type="date" name="from" defaultValue={sp.from} />
        </label>
        <label className="space-y-1 text-sm">
          Đến ngày
          <Input type="date" name="to" defaultValue={sp.to} />
        </label>
        <Button type="submit" variant="secondary">
          Lọc
        </Button>
      </form>

      {rows.length === 0 ? (
        <EmptyState title="Chưa có ca nào" />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-background">
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
                    <TableCell className={`text-right tabular-nums ${diff < 0 ? "text-red-700" : diff > 0 ? "text-amber-700" : ""}`}>
                      {s.cash_diff == null ? "-" : formatMoney(diff)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={st.variant}>{st.label}</Badge>
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
