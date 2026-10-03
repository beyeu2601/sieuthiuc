import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { ChipSac, sacKenhBan, type SacNguNghia } from "@/components/ui/chip";
import { ChiSo, HangChiSo } from "@/components/ui/chi-so";
import { Khoi } from "@/components/khoi";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ONLINE_CHANNELS, ORDER_STATUS, RETURN_STATUS } from "../labels";
import { OrderActions } from "./order-actions";
import { DeleteOrder } from "./delete-order";

const RETURN_SAC: Record<string, SacNguNghia> = { pending_check: "amber", restocked: "emerald", discarded: "red" };

export default async function OrderPage({ params }: { params: Promise<{ store: string; id: string }> }) {
  const { store: code, id } = await params;
  const { ctx, store } = await requireStore(code);
  const supabase = await createClient();
  const { data: o } = await supabase
    .from("orders")
    .select("id, code, channel, external_order_id, customer_name, customer_phone, shipping_address, status, subtotal, shipping_fee, discount_amount, discount_note, platform_fee, total, payment_method, sale_id, note, cancel_reason, created_at, payout_id, return_reason, return_status, return_checked_at, return_check_note")
    .eq("id", id)
    .eq("store_id", store.id)
    .maybeSingle();
  if (!o) notFound();
  const [{ data: items }, { data: history }, { data: payout }] = await Promise.all([
    supabase.from("order_items").select("id, product_id, qty, unit_price").eq("order_id", id),
    supabase.from("order_status_history").select("id, to_status, changed_at, note, profiles:changed_by(full_name)").eq("order_id", id).order("changed_at"),
    // Nhan vien khong doc duoc bang doi soat (RLS) -> chi hien "Đã nhận tiền"
    o.payout_id
      ? supabase.from("platform_payouts").select("id, code, received_on").eq("id", o.payout_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const ids = [...new Set((items ?? []).map((i) => i.product_id))];
  const { data: prods } = ids.length ? await supabase.rpc("catalog_by_ids", { p_ids: ids }) : { data: [] };
  const pmap = new Map(((prods ?? []) as { product_id: string; name: string; unit: string }[]).map((p) => [p.product_id, p]));
  const st = ORDER_STATUS[o.status as keyof typeof ORDER_STATUS];

  const itemRows = items ?? [];
  const historyRows = history ?? [];
  const shopeeDelivered = o.channel === "shopee" && o.status === "delivered";
  const isManager = ctx.profile.role === "sadmin" || ctx.profile.role === "admin";
  // Khop dieu kien cua delete_order
  const canDelete =
    isManager && !o.payout_id && (o.status === "cancelled" || (o.status === "returned" && o.return_status === "restocked"));

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Đơn ${o.code}`}
        description={
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <ChipSac sac={st.sac}>{st.label}</ChipSac>
            <ChipSac sac={sacKenhBan(o.channel)}>{ONLINE_CHANNELS[o.channel as keyof typeof ONLINE_CHANNELS]}</ChipSac>
            {o.external_order_id && (
              <ChipSac sac="slate" className="font-mono">
                {o.external_order_id}
              </ChipSac>
            )}
            <ChipSac sac="slate">{formatDateTime(o.created_at)}</ChipSac>
            {o.return_status && (
              <ChipSac sac={RETURN_SAC[o.return_status] ?? "slate"}>{RETURN_STATUS[o.return_status as keyof typeof RETURN_STATUS]}</ChipSac>
            )}
            {shopeeDelivered && <ChipSac sac={o.payout_id ? "emerald" : "amber"}>{o.payout_id ? "Đã nhận tiền Shopee" : "Chờ Shopee trả"}</ChipSac>}
          </span>
        }
        actions={
          ctx.profile.role !== "accountant" && (
            <OrderActions
              storeCode={store.code}
              id={o.id}
              status={o.status}
              paidOut={!!o.payout_id}
              returnStatus={o.return_status}
              isManager={isManager}
            />
          )
        }
      />
      {(o.cancel_reason || o.return_reason) && (
        <div className="space-y-1 rounded-lg bg-destructive/10 px-3 py-2 text-sm">
          {o.cancel_reason && <p>Lý do hủy: {o.cancel_reason}</p>}
          {o.return_reason && <p>Lý do hoàn hàng: {o.return_reason}</p>}
          {o.return_status && (o.return_checked_at || o.return_check_note) && (
            <p className="text-muted-foreground">
              Kiểm hàng hoàn{o.return_checked_at ? ` lúc ${formatDateTime(o.return_checked_at)}` : ""}
              {o.return_check_note ? ` - ${o.return_check_note}` : ""}
            </p>
          )}
        </div>
      )}

      <HangChiSo className="lg:grid-cols-3">
        <ChiSo
          nhan={o.status === "cancelled" ? "Tổng đơn - đã hủy" : o.status === "returned" ? "Tổng đơn - hoàn hàng" : "Tổng đơn"}
          sac={o.status === "cancelled" || o.status === "returned" ? "red" : "brand"}
          giaTri={formatMoney(o.total)}
          phu={`Tiền hàng ${formatMoney(o.subtotal)}`}
        />
        <ChiSo nhan="Phí ship" sac={o.shipping_fee ? "brand" : "slate"} giaTri={o.shipping_fee ? formatMoney(o.shipping_fee) : "-"} />
        <ChiSo
          nhan={o.discount_amount ? "Giảm giá / voucher" : "Không giảm giá"}
          sac={o.discount_amount ? "amber" : "slate"}
          giaTri={o.discount_amount ? formatMoney(o.discount_amount) : "-"}
          phu={o.discount_note ?? undefined}
        />
      </HangChiSo>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="min-w-0 rounded-xl border bg-card p-4">
          <Tabs defaultValue="items">
            <TabsList>
              <TabsTrigger value="items" className="px-3">
                Sản phẩm ({itemRows.length})
              </TabsTrigger>
              <TabsTrigger value="history" className="px-3">
                Lịch sử ({historyRows.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="items" className="pt-2">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sản phẩm</TableHead>
                      <TableHead className="text-right">SL</TableHead>
                      <TableHead className="text-right">Giá</TableHead>
                      <TableHead className="text-right">Thành tiền</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itemRows.map((i) => {
                      const p = pmap.get(i.product_id);
                      return (
                        <TableRow key={i.id}>
                          <TableCell>{p?.name}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatNumber(i.qty)} {p?.unit}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{formatMoney(i.unit_price)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatMoney(Math.round(Number(i.qty) * i.unit_price))}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            <TabsContent value="history" className="pt-2">
              <ul className="space-y-1">
                {historyRows.map((h) => (
                  <li key={h.id}>
                    {formatDateTime(h.changed_at)} - {ORDER_STATUS[h.to_status as keyof typeof ORDER_STATUS].label} -{" "}
                    {(h.profiles as unknown as { full_name: string } | null)?.full_name ?? ""}
                    {h.note ? `: ${h.note}` : ""}
                  </li>
                ))}
              </ul>
            </TabsContent>
          </Tabs>
        </section>

        <div className="min-w-0 space-y-4">
          <Khoi title="Khách hàng" className="text-sm">
            <p className="font-medium">{o.customer_name ?? "Khách chưa ghi tên"}</p>
            <p>{o.customer_phone ?? "-"}</p>
            {o.shipping_address && <p className="text-muted-foreground">{o.shipping_address}</p>}
            {o.note && <p className="mt-2">Ghi chú: {o.note}</p>}
          </Khoi>

          <Khoi title="Tiền đơn" className="text-sm">
            <dl className="grid grid-cols-2 gap-y-1">
              <dt>Tiền hàng</dt>
              <dd className="text-right tabular-nums">{formatMoney(o.subtotal)}</dd>
              <dt>Phí ship</dt>
              <dd className="text-right tabular-nums">{formatMoney(o.shipping_fee)}</dd>
              <dt>Giảm giá</dt>
              <dd className="text-right tabular-nums">-{formatMoney(o.discount_amount)}</dd>
              <dt className="font-semibold">Tổng đơn</dt>
              <dd className="text-right font-semibold tabular-nums">{formatMoney(o.total)}</dd>
              {o.platform_fee > 0 && (
                <>
                  <dt>Phí sàn Shopee</dt>
                  <dd className="text-right tabular-nums">-{formatMoney(o.platform_fee)}</dd>
                  <dt className="font-semibold">Shopee trả về</dt>
                  <dd className="text-right font-semibold tabular-nums">{formatMoney(o.subtotal - o.discount_amount - o.platform_fee)}</dd>
                </>
              )}
            </dl>
            {o.discount_note && <p className="mt-2">Lý do giảm: {o.discount_note}</p>}
            {shopeeDelivered && payout && (
              <Link href={`/${store.code}/orders/payouts/${payout.id}`} className="mt-2 block underline underline-offset-4">
                Đã nhận tiền đợt {payout.code}
              </Link>
            )}
            {o.sale_id && (
              <Link href={`/${store.code}/sales/${o.sale_id}`} className="mt-2 block underline underline-offset-4">
                Xem giao dịch bán đã ghi nhận
              </Link>
            )}
          </Khoi>

          {canDelete && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-destructive/40 px-4 py-3">
              <p className="text-xs text-muted-foreground">Đơn đã hủy hoặc đã hoàn và nhập lại kho.</p>
              <DeleteOrder storeCode={store.code} id={o.id} code={o.code} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
