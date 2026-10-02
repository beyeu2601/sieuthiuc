import Link from "next/link";
import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateVN } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ChipSac } from "@/components/ui/chip";
import { ChiSo, HangChiSo } from "@/components/ui/chi-so";
import { MobileCard, MobileCardList } from "@/components/mobile-card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata = { title: "Đối soát Shopee" };

// % phi tren tong don, mot chu so thap phan
const feePct = (fee: number, total: number) => (total > 0 ? `${((fee / total) * 100).toFixed(1).replace(".", ",")}%` : "-");

export default async function PayoutsPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: code } = await params;
  const { store } = await requireStore(code, "sadmin", "admin", "accountant");
  const supabase = await createClient();
  const [{ data: unpaid }, { data: payouts }] = await Promise.all([
    supabase
      .from("orders")
      .select("subtotal, discount_amount")
      .eq("store_id", store.id)
      .eq("channel", "shopee")
      .eq("status", "delivered")
      .is("payout_id", null),
    supabase
      .from("platform_payouts")
      .select("id, code, received_on, order_count, orders_total, amount_received, ads_amount, fee_amount, status, money_accounts(name)")
      .eq("store_id", store.id)
      .order("received_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  const owed = (unpaid ?? []).reduce((s, o) => s + o.subtotal - o.discount_amount, 0);
  const rows = payouts ?? [];
  const unpaidCount = (unpaid ?? []).length;
  const latest = rows.find((r) => r.status !== "cancelled");

  return (
    <div>
      <PageHeader
        title="Đối soát Shopee"
        back={{ href: `/${store.code}/orders`, label: "Đơn online" }}
        actions={
          <Button
            render={<Link href={`/${store.code}/orders/payouts/new`} />}
            title="Shopee trả tiền theo đợt, gộp nhiều đơn và đã trừ phí sàn. Mỗi lần tiền về ngân hàng, tick các đơn trong đợt để ghi nhận."
          >
            Ghi đợt tiền về
          </Button>
        }
      />
      <HangChiSo className="mb-4">
        <ChiSo
          nhan={unpaidCount > 0 ? "Shopee còn nợ" : "Shopee không còn nợ"}
          sac={unpaidCount > 0 ? "amber" : "emerald"}
          giaTri={formatMoney(owed)}
          phu={`${unpaidCount} đơn đã giao chưa nhận tiền, chưa trừ phí sàn`}
        />
        <ChiSo
          nhan="Đợt tiền về gần nhất"
          sac={latest ? "brand" : "slate"}
          giaTri={latest ? formatMoney(latest.amount_received) : "-"}
          phu={latest ? `${formatDateVN(latest.received_on)} - ${latest.order_count} đơn` : "Chưa có đợt nào"}
        />
      </HangChiSo>
      {rows.length === 0 ? (
        <EmptyState title="Chưa có đợt đối soát nào" />
      ) : (
        <>
          <MobileCardList label="Đợt đối soát Shopee">
            {rows.map((r) => (
              <MobileCard
                key={r.id}
                title={
                  <Link href={`/${store.code}/orders/payouts/${r.id}`} className="underline-offset-4 hover:underline">
                    {r.code}
                  </Link>
                }
                subtitle={`${formatDateVN(r.received_on)} - ${(r.money_accounts as unknown as { name: string } | null)?.name ?? "-"}`}
                badge={
                  r.status === "cancelled" ? (
                    <ChipSac sac="red">Đã hủy</ChipSac>
                  ) : undefined
                }
                stats={[
                  { label: "Thực nhận", value: formatMoney(r.amount_received), strong: true },
                  { label: "Tổng đơn", value: formatMoney(r.orders_total) },
                  { label: "Phí sàn", value: `${formatMoney(r.fee_amount)} (${feePct(r.fee_amount, r.orders_total)})` },
                ]}
              />
            ))}
          </MobileCardList>
          <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã đợt</TableHead>
                  <TableHead>Ngày nhận</TableHead>
                  <TableHead>Tài khoản</TableHead>
                  <TableHead className="text-right">Số đơn</TableHead>
                  <TableHead className="text-right">Tổng đơn</TableHead>
                  <TableHead className="text-right">Thực nhận</TableHead>
                  <TableHead className="text-right">Phí sàn</TableHead>
                  <TableHead className="text-right">Quảng cáo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className={r.status === "cancelled" ? "text-muted-foreground" : undefined}>
                    <TableCell>
                      <Link href={`/${store.code}/orders/payouts/${r.id}`} className="font-medium hover:underline">
                        {r.code}
                      </Link>
                      {r.status === "cancelled" && (
                        <ChipSac sac="red" className="ml-2">
                          Đã hủy
                        </ChipSac>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatDateVN(r.received_on)}</TableCell>
                    <TableCell>{(r.money_accounts as unknown as { name: string } | null)?.name ?? "-"}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.order_count}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(r.orders_total)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(r.amount_received)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap tabular-nums">
                      {formatMoney(r.fee_amount)}
                      <div className="text-xs text-muted-foreground">{feePct(r.fee_amount, r.orders_total)}</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(r.ads_amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
