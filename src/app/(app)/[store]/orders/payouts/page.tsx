import Link from "next/link";
import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateVN } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
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

  return (
    <div>
      <PageHeader
        title="Đối soát Shopee"
        back={{ href: `/${store.code}/orders`, label: "Đơn online" }}
        description="Shopee trả tiền theo đợt, gộp nhiều đơn và đã trừ phí sàn. Mỗi lần tiền về ngân hàng, tick các đơn trong đợt để ghi nhận."
        actions={<Button render={<Link href={`/${store.code}/orders/payouts/new`} />}>Ghi đợt tiền về</Button>}
      />
      <div className="mb-4 rounded-xl border bg-card p-4">
        <div className="text-sm text-muted-foreground">Shopee còn nợ (tiền hàng đơn đã giao, chưa nhận)</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{formatMoney(owed)}</div>
        <div className="text-sm text-muted-foreground">{(unpaid ?? []).length} đơn, chưa trừ phí sàn</div>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="Chưa có đợt đối soát nào" />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
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
                      <Badge variant="destructive" className="ml-2">
                        Đã hủy
                      </Badge>
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
      )}
    </div>
  );
}
