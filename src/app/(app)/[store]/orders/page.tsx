import Link from "next/link";
import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { FilterBar } from "@/components/filter-bar";
import { EmptyState } from "@/components/empty-state";
import { NativeSelect } from "@/components/native-select";
import { Pagination } from "@/components/pagination";
import { ChipSac } from "@/components/ui/chip";
import { MobileCard, MobileCardList } from "@/components/mobile-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ONLINE_CHANNELS, ORDER_STATUS } from "./labels";

export const metadata = { title: "Đơn online" };
const PAGE_SIZE = 50;

type SP = { status?: string; channel?: string; q?: string; page?: string };

export default async function OrdersPage({ params, searchParams }: { params: Promise<{ store: string }>; searchParams: Promise<SP> }) {
  const { store: code } = await params;
  const sp = await searchParams;
  const { ctx, store } = await requireStore(code);
  const status = sp.status ?? "open";
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();
  let q = supabase
    .from("orders")
    .select("id, code, channel, external_order_id, customer_name, customer_phone, status, total, created_at, payout_id, return_status", { count: "exact" })
    .eq("store_id", store.id)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status === "open") q = q.in("status", ["pending", "shipped"]);
  else if (status === "return_check") q = q.eq("return_status", "pending_check");
  else if (status in ORDER_STATUS) q = q.eq("status", status);
  if (sp.channel && sp.channel in ONLINE_CHANNELS) q = q.eq("channel", sp.channel);
  if (sp.q?.trim()) {
    const t = sp.q.trim().replace(/[,()%]/g, " ");
    q = q.or(`code.ilike.%${t}%,external_order_id.ilike.%${t}%,customer_phone.ilike.%${t}%,customer_name.ilike.%${t}%`);
  }
  const role = ctx.profile.role;
  const [{ data, count }, { count: returnCheck }] = await Promise.all([
    q,
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("store_id", store.id).eq("return_status", "pending_check"),
  ]);
  const rows = data ?? [];
  const canCreate = role !== "accountant";
  const canPayout = role === "sadmin" || role === "admin" || role === "accountant";

  return (
    <div>
      <PageHeader
        title="Đơn online"
        description="Đơn Shopee, Facebook nhập tay. Hàng được giữ ngay khi tạo đơn, quầy không bán vượt."
        actions={
          <>
            {canPayout && (
              <Button variant="outline" render={<Link href={`/${store.code}/orders/payouts`} />}>
                Đối soát Shopee
              </Button>
            )}
            {canCreate && <Button render={<Link href={`/${store.code}/orders/new`} />}>Tạo đơn</Button>}
          </>
        }
      />
      {!!returnCheck && status !== "return_check" && (
        <p className="mb-3 rounded-lg border bg-card px-3 py-2 text-sm">
          Có {returnCheck} đơn hoàn hàng chờ quản lý kiểm hàng.{" "}
          <Link href={`/${store.code}/orders?status=return_check`} className="font-medium underline underline-offset-4">
            Xem
          </Link>
        </p>
      )}
      <AutoSubmitForm action={`/${store.code}/orders`} debounceMs={400} className="mb-3" role="search">
        <FilterBar search={<Input type="search" enterKeyHint="search" name="q" defaultValue={sp.q} placeholder="Mã đơn, mã sàn, tên hoặc SĐT khách" aria-label="Tìm đơn" />}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-[200px_160px]">
            <NativeSelect name="status" defaultValue={status} aria-label="Trạng thái">
              <option value="open">Đang xử lý</option>
              {Object.entries(ORDER_STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
              <option value="return_check">Hoàn hàng chờ kiểm</option>
              <option value="all">Tất cả</option>
            </NativeSelect>
            <NativeSelect name="channel" defaultValue={sp.channel ?? ""} aria-label="Kênh">
              <option value="">Mọi kênh</option>
              {Object.entries(ONLINE_CHANNELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </NativeSelect>
          </div>
        </FilterBar>
      </AutoSubmitForm>
      {rows.length === 0 ? (
        <EmptyState title="Không có đơn phù hợp" />
      ) : (
        <>
          <MobileCardList label="Đơn online">
            {rows.map((o) => {
              const st = ORDER_STATUS[o.status as keyof typeof ORDER_STATUS];
              return (
                <MobileCard
                  key={o.id}
                  title={
                    <Link href={`/${store.code}/orders/${o.id}`} className="underline-offset-4 hover:underline">
                      {o.code}
                    </Link>
                  }
                  subtitle={`${formatDateTime(o.created_at)}${o.external_order_id ? ` - ${o.external_order_id}` : ""}`}
                  badge={<ChipSac sac={st.sac}>{st.label}</ChipSac>}
                  stats={[
                    { label: "Tổng", value: formatMoney(o.total), strong: true },
                    { label: "Kênh", value: ONLINE_CHANNELS[o.channel as keyof typeof ONLINE_CHANNELS] },
                    { label: "Khách", value: o.customer_name ?? "-" },
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
                  <TableHead>Kênh</TableHead>
                  <TableHead>Khách</TableHead>
                  <TableHead>Tạo lúc</TableHead>
                  <TableHead className="text-right">Tổng</TableHead>
                  <TableHead>Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((o) => {
                  const st = ORDER_STATUS[o.status as keyof typeof ORDER_STATUS];
                  return (
                    <TableRow key={o.id}>
                      <TableCell>
                        <Link href={`/${store.code}/orders/${o.id}`} className="font-medium hover:underline">
                          {o.code}
                        </Link>
                        {o.external_order_id && <div className="text-xs text-muted-foreground">{o.external_order_id}</div>}
                      </TableCell>
                      <TableCell>{ONLINE_CHANNELS[o.channel as keyof typeof ONLINE_CHANNELS]}</TableCell>
                      <TableCell>
                        {o.customer_name ?? "-"}
                        {o.customer_phone && <div className="text-xs text-muted-foreground">{o.customer_phone}</div>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatDateTime(o.created_at)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(o.total)}</TableCell>
                      <TableCell>
                        <ChipSac sac={st.sac}>{st.label}</ChipSac>
                        {o.channel === "shopee" && o.status === "delivered" && (
                          <div className="text-xs text-muted-foreground">{o.payout_id ? "Đã nhận tiền" : "Chờ Shopee trả"}</div>
                        )}
                        {o.return_status === "pending_check" && <div className="text-xs text-muted-foreground">Chờ kiểm hàng</div>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={count ?? 0}
        basePath={`/${store.code}/orders`}
        params={{ status, channel: sp.channel, q: sp.q }}
      />
    </div>
  );
}
