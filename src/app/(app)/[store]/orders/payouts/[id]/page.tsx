import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateVN } from "@/lib/dates";
import { formatDateTime, formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { ChipSac } from "@/components/ui/chip";
import { ChiSo, HangChiSo } from "@/components/ui/chi-so";
import { Khoi } from "@/components/khoi";
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

  const orderRows = orders ?? [];
  // % phi tren tong don, mot chu so thap phan (giong man danh sach doi soat)
  const feePct = r.orders_total > 0 ? `${((r.fee_amount / r.orders_total) * 100).toFixed(1).replace(".", ",")}% tổng đơn` : undefined;

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Đợt ${r.code}`}
        back={{ href: `/${store.code}/orders/payouts`, label: "Đối soát Shopee" }}
        description={
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {r.status === "cancelled" && <ChipSac sac="red">Đã hủy</ChipSac>}
            <ChipSac sac="slate">Tiền về {formatDateVN(r.received_on)}</ChipSac>
            <ChipSac sac="slate">{(r.money_accounts as unknown as { name: string } | null)?.name ?? "-"}</ChipSac>
            <ChipSac sac="slate">
              Ghi bởi {(r.creator as unknown as { full_name: string } | null)?.full_name ?? ""} lúc {formatDateTime(r.created_at)}
            </ChipSac>
          </span>
        }
        actions={isManager && r.status === "active" && <CancelPayoutButton storeCode={store.code} id={r.id} />}
      />
      {r.status === "cancelled" && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Đã hủy lúc {formatDateTime(r.cancelled_at)}: {r.cancel_reason}. Các đơn đã trở về chờ Shopee trả.
        </p>
      )}

      <HangChiSo>
        <ChiSo nhan="Tổng đơn" sac="brand" giaTri={formatMoney(r.orders_total)} phu={`${r.order_count} đơn`} />
        <ChiSo nhan="Thực nhận" sac="emerald" giaTri={formatMoney(r.amount_received)} />
        <ChiSo
          nhan={r.fee_amount >= 0 ? "Phí sàn" : "Shopee trả dư (Thu khác)"}
          sac={r.fee_amount >= 0 ? "amber" : "emerald"}
          giaTri={formatMoney(Math.abs(r.fee_amount))}
          phu={r.fee_amount >= 0 ? feePct : undefined}
        />
        <ChiSo
          nhan="Quảng cáo Shopee"
          sac={r.ads_amount ? "amber" : "slate"}
          giaTri={r.ads_amount ? formatMoney(r.ads_amount) : "-"}
          phu={r.ads_amount ? "Trừ nạp quảng cáo từ doanh thu" : undefined}
        />
      </HangChiSo>

      <div className={r.note ? "grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_420px]" : undefined}>
        {r.status === "active" && (
          <Khoi
            title="Đơn trong đợt"
            className="min-w-0"
            aside={<span className="text-xs text-muted-foreground tabular-nums">{orderRows.length}</span>}
          >
            <div className="overflow-x-auto">
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
                  {orderRows.map((o) => (
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
          </Khoi>
        )}
        {r.note && (
          <Khoi title="Ghi chú" className="text-sm lg:col-start-2">
            <p className="whitespace-pre-line">{r.note}</p>
          </Khoi>
        )}
      </div>
    </div>
  );
}
