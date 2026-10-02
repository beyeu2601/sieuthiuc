import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateVN } from "@/lib/dates";
import { formatDateTime, formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { ChipSac } from "@/components/ui/chip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CancelPayoutButton } from "./cancel-button";

export const metadata = { title: "Đợt đối soát Shopee" };

export default async function PayoutPage({ params }: { params: Promise<{ store: string; id: string }> }) {
  const { store: code, id } = await params;
  const { ctx, store } = await requireStore(code, "sadmin", "admin", "accountant");
  const supabase = await createClient();
  const { data: r } = await supabase
    .from("platform_payouts")
    .select("id, code, received_on, order_count, orders_total, amount_received, ads_amount, fee_amount, note, status, cancel_reason, cancelled_at, created_at, money_accounts(name), creator:created_by(full_name)")
    .eq("id", id)
    .eq("store_id", store.id)
    .maybeSingle();
  if (!r) notFound();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, code, external_order_id, customer_name, subtotal, discount_amount")
    .eq("payout_id", id)
    .order("created_at");
  const isManager = ctx.profile.role === "sadmin" || ctx.profile.role === "admin";

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader
        title={`Đợt ${r.code}`}
        back={{ href: `/${store.code}/orders/payouts`, label: "Đối soát Shopee" }}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {r.status === "cancelled" && <ChipSac sac="red">Đã hủy</ChipSac>}
            Tiền về {formatDateVN(r.received_on)} - {(r.money_accounts as unknown as { name: string } | null)?.name} - ghi bởi{" "}
            {(r.creator as unknown as { full_name: string } | null)?.full_name ?? ""} lúc {formatDateTime(r.created_at)}
          </span>
        }
        actions={isManager && r.status === "active" && <CancelPayoutButton storeCode={store.code} id={r.id} />}
      />
      {r.status === "cancelled" && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Đã hủy lúc {formatDateTime(r.cancelled_at)}: {r.cancel_reason}. Các đơn đã trở về chờ Shopee trả.
        </p>
      )}
      <div className="rounded-xl border bg-card p-4 text-sm">
        <dl className="grid grid-cols-2 gap-y-1">
          <dt>Tổng {r.order_count} đơn</dt>
          <dd className="text-right tabular-nums">{formatMoney(r.orders_total)}</dd>
          <dt>Thực nhận</dt>
          <dd className="text-right tabular-nums">{formatMoney(r.amount_received)}</dd>
          <dt>Quảng cáo Shopee</dt>
          <dd className="text-right tabular-nums">{formatMoney(r.ads_amount)}</dd>
          <dt className="font-semibold">{r.fee_amount >= 0 ? "Phí sàn" : "Shopee trả dư (Thu khác)"}</dt>
          <dd className="text-right font-semibold tabular-nums">{formatMoney(Math.abs(r.fee_amount))}</dd>
        </dl>
        {r.note && <p className="mt-2">Ghi chú: {r.note}</p>}
      </div>
      {r.status === "active" && (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã Shopee</TableHead>
                <TableHead>Đơn</TableHead>
                <TableHead>Khách</TableHead>
                <TableHead className="text-right">Tiền hàng</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(orders ?? []).map((o) => (
                <TableRow key={o.id}>
                  <TableCell>{o.external_order_id ?? "-"}</TableCell>
                  <TableCell>
                    <Link href={`/${store.code}/orders/${o.id}`} className="hover:underline">
                      {o.code}
                    </Link>
                  </TableCell>
                  <TableCell>{o.customer_name ?? "-"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(o.subtotal - o.discount_amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
