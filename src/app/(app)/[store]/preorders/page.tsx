import Link from "next/link";
import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateVN, todayVN } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { FilterBar } from "@/components/filter-bar";
import { EmptyState } from "@/components/empty-state";
import { LuaChon } from "@/components/lua-chon";
import { Pagination } from "@/components/pagination";
import { ChipSac } from "@/components/ui/chip";
import { MobileCard, MobileCardList } from "@/components/mobile-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PREORDER_STATUS, type PreorderStatus } from "./labels";
import { HanTra } from "./han-tra";

export const metadata = { title: "Đặt trước" };
const PAGE_SIZE = 50;

type SP = { status?: string; q?: string; page?: string };

export default async function PreordersPage({ params, searchParams }: { params: Promise<{ store: string }>; searchParams: Promise<SP> }) {
  const { store: code } = await params;
  const sp = await searchParams;
  const { ctx, store } = await requireStore(code);
  const status = sp.status ?? "active";
  const page = Math.max(1, Number(sp.page) || 1);
  const today = todayVN();
  const supabase = await createClient();
  let q = supabase
    .from("preorders")
    .select("id, code, customer_name, customer_phone, ordered_on, due_on, status, subtotal", { count: "exact" })
    .eq("store_id", store.id)
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  // Don dang mo: hen tra gan nhat len dau. Con lai: moi tao len dau.
  if (status === "active") q = q.in("status", ["open", "arrived"]).order("due_on").order("created_at");
  else {
    if (status in PREORDER_STATUS) q = q.eq("status", status);
    q = q.order("created_at", { ascending: false });
  }
  if (sp.q?.trim()) {
    const t = sp.q.trim().replace(/[,()%]/g, " ");
    q = q.or(`code.ilike.%${t}%,customer_phone.ilike.%${t}%,customer_name.ilike.%${t}%`);
  }
  const { data, count } = await q;
  const rows = data ?? [];
  const { data: pays } = rows.length
    ? await supabase.from("preorder_payments").select("preorder_id, kind, amount").in("preorder_id", rows.map((r) => r.id))
    : { data: [] };
  const paid = new Map<string, number>();
  for (const p of pays ?? []) paid.set(p.preorder_id, (paid.get(p.preorder_id) ?? 0) + (p.kind === "deposit" ? p.amount : -p.amount));
  const canCreate = ctx.profile.role !== "accountant";

  return (
    <div>
      <PageHeader
        title="Đặt trước"
        description="Khách đặt hàng order, cọc trước, hẹn ngày trả"
        actions={
          canCreate && (
            <Button render={<Link href={`/${store.code}/preorders/new`} />}>Tạo đơn đặt trước</Button>
          )
        }
      />
      <AutoSubmitForm action={`/${store.code}/preorders`} debounceMs={400} className="mb-3" role="search">
        <FilterBar search={<Input type="search" enterKeyHint="search" name="q" defaultValue={sp.q} placeholder="Mã đơn, tên hoặc SĐT khách" aria-label="Tìm đơn đặt trước" />}>
          <div className="sm:w-[200px]">
            <LuaChon
              name="status"
              defaultValue={status}
              aria-label="Trạng thái"
              options={[
                { value: "active", label: "Đang mở" },
                ...Object.entries(PREORDER_STATUS).map(([k, v]) => ({ value: k, label: v.label })),
                { value: "all", label: "Tất cả" },
              ]}
            />
          </div>
        </FilterBar>
      </AutoSubmitForm>
      {rows.length === 0 ? (
        <EmptyState
          title={status === "active" ? "Chưa có đơn đặt trước nào đang mở" : "Không có đơn phù hợp"}
          action={
            canCreate && status === "active" ? (
              <Button render={<Link href={`/${store.code}/preorders/new`} />}>Tạo đơn đặt trước</Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <MobileCardList label="Đơn đặt trước">
            {rows.map((o) => {
              const st = PREORDER_STATUS[o.status as PreorderStatus];
              const dep = paid.get(o.id) ?? 0;
              return (
                <MobileCard
                  key={o.id}
                  title={
                    <Link href={`/${store.code}/preorders/${o.id}`} className="underline-offset-4 hover:underline">
                      {o.customer_name}
                    </Link>
                  }
                  subtitle={`${o.code} - hẹn trả ${formatDateVN(o.due_on)}`}
                  badge={
                    <span className="flex flex-wrap justify-end gap-1">
                      <HanTra due={o.due_on} status={o.status} today={today} />
                      <ChipSac sac={st.sac}>{st.label}</ChipSac>
                    </span>
                  }
                  stats={[
                    { label: "Tiền hàng", value: formatMoney(o.subtotal), strong: true },
                    { label: "Đã cọc", value: formatMoney(dep) },
                    { label: "Còn lại", value: o.status === "delivered" || o.status === "cancelled" ? "-" : formatMoney(o.subtotal - dep) },
                  ]}
                />
              );
            })}
          </MobileCardList>
          <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Khách</TableHead>
                  <TableHead>Mã</TableHead>
                  <TableHead>Ngày đặt</TableHead>
                  <TableHead>Hẹn trả</TableHead>
                  <TableHead className="text-right">Tiền hàng</TableHead>
                  <TableHead className="text-right">Đã cọc</TableHead>
                  <TableHead className="text-right">Còn lại</TableHead>
                  <TableHead>Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((o) => {
                  const st = PREORDER_STATUS[o.status as PreorderStatus];
                  const dep = paid.get(o.id) ?? 0;
                  return (
                    <TableRow key={o.id}>
                      <TableCell>
                        <Link href={`/${store.code}/preorders/${o.id}`} className="font-medium hover:underline">
                          {o.customer_name}
                        </Link>
                        {o.customer_phone && <div className="text-xs text-muted-foreground">{o.customer_phone}</div>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{o.code}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDateVN(o.ordered_on)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDateVN(o.due_on)}
                        <div>
                          <HanTra due={o.due_on} status={o.status} today={today} />
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(o.subtotal)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(dep)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {o.status === "delivered" || o.status === "cancelled" ? "-" : formatMoney(o.subtotal - dep)}
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
      <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} basePath={`/${store.code}/preorders`} params={{ status, q: sp.q }} />
    </div>
  );
}
