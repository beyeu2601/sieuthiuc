import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ONLINE_CHANNELS, ORDER_STATUS } from "../labels";
import { OrderActions } from "./order-actions";

export default async function OrderPage({ params }: { params: Promise<{ store: string; id: string }> }) {
  const { store: code, id } = await params;
  const { ctx, store } = await requireStore(code);
  const supabase = await createClient();
  const { data: o } = await supabase
    .from("orders")
    .select("id, code, channel, external_order_id, customer_name, customer_phone, shipping_address, status, subtotal, shipping_fee, discount_amount, total, payment_method, sale_id, note, cancel_reason, created_at")
    .eq("id", id)
    .eq("store_id", store.id)
    .maybeSingle();
  if (!o) notFound();
  const [{ data: items }, { data: history }] = await Promise.all([
    supabase.from("order_items").select("id, product_id, qty, unit_price").eq("order_id", id),
    supabase.from("order_status_history").select("id, to_status, changed_at, note, profiles:changed_by(full_name)").eq("order_id", id).order("changed_at"),
  ]);
  const ids = [...new Set((items ?? []).map((i) => i.product_id))];
  const { data: prods } = ids.length ? await supabase.rpc("catalog_by_ids", { p_ids: ids }) : { data: [] };
  const pmap = new Map(((prods ?? []) as { product_id: string; name: string; unit: string }[]).map((p) => [p.product_id, p]));
  const st = ORDER_STATUS[o.status as keyof typeof ORDER_STATUS];

  return (
    <div className="max-w-4xl space-y-4">
      <PageHeader
        title={`Đơn ${o.code}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant={st.variant}>{st.label}</Badge>
            {ONLINE_CHANNELS[o.channel as keyof typeof ONLINE_CHANNELS]}
            {o.external_order_id ? ` - ${o.external_order_id}` : ""} - {formatDateTime(o.created_at)}
          </span>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-4 text-sm">
          <p className="font-medium">{o.customer_name ?? "Khách chưa ghi tên"}</p>
          <p>{o.customer_phone ?? "-"}</p>
          <p className="text-muted-foreground">{o.shipping_address ?? ""}</p>
          {o.note && <p className="mt-2">Ghi chú: {o.note}</p>}
          {o.cancel_reason && <p className="mt-2 text-destructive">Lý do hủy: {o.cancel_reason}</p>}
        </div>
        <div className="rounded-xl border bg-card p-4 text-sm">
          <dl className="grid grid-cols-2 gap-y-1">
            <dt>Tiền hàng</dt>
            <dd className="text-right tabular-nums">{formatMoney(o.subtotal)}</dd>
            <dt>Phí ship</dt>
            <dd className="text-right tabular-nums">{formatMoney(o.shipping_fee)}</dd>
            <dt>Giảm giá</dt>
            <dd className="text-right tabular-nums">-{formatMoney(o.discount_amount)}</dd>
            <dt className="font-semibold">Tổng đơn</dt>
            <dd className="text-right font-semibold tabular-nums">{formatMoney(o.total)}</dd>
          </dl>
          {o.sale_id && (
            <Link href={`/${store.code}/sales/${o.sale_id}`} className="mt-2 inline-block underline underline-offset-4">
              Xem giao dịch bán đã ghi nhận
            </Link>
          )}
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
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
            {(items ?? []).map((i) => {
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
      {ctx.profile.role !== "accountant" && <OrderActions storeCode={store.code} id={o.id} status={o.status} />}
      <section className="rounded-xl border bg-card p-4 text-sm">
        <h2 className="mb-2 font-medium">Lịch sử trạng thái</h2>
        <ul className="space-y-1">
          {(history ?? []).map((h) => (
            <li key={h.id}>
              {formatDateTime(h.changed_at)} - {ORDER_STATUS[h.to_status as keyof typeof ORDER_STATUS].label} -{" "}
              {(h.profiles as unknown as { full_name: string } | null)?.full_name ?? ""}
              {h.note ? `: ${h.note}` : ""}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
