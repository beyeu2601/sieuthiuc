import Link from "next/link";
import { requireStore } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { todayVN } from "@/lib/dates";
import { formatMoney, formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";

type Overview = { active_products: number; skus_in_stock: number; total_qty: number; stock_value: number | null };
type Pnl = { net_revenue: number; gross_profit: number; net_profit: number };

export default async function StoreHome({ params }: { params: Promise<{ store: string }> }) {
  const { store: code } = await params;
  const { ctx, store } = await requireStore(code);
  const isFinance = ctx.profile.role !== "staff";
  const today = todayVN();
  const supabase = await createClient();

  const [{ data: ov }, { data: myShift }, pnlRes, lowRes, nearRes, debtRes, pendingOrders] = await Promise.all([
    supabase.rpc("store_overview", { p_store_id: store.id }),
    supabase.from("shifts").select("id, code").eq("store_id", store.id).eq("user_id", ctx.profile.id).eq("status", "open").maybeSingle(),
    isFinance ? supabase.rpc("pnl_report", { p_store_ids: [store.id], p_from: today, p_to: today }) : Promise.resolve({ data: null }),
    supabase.rpc("inventory_status", { p_store_id: store.id, p_status: "low_out", p_limit: 1 }),
    supabase.rpc("lot_expiry", { p_store_id: store.id, p_status: "near" }),
    isFinance ? supabase.rpc("debt_overview", { p_store_ids: [store.id] }) : Promise.resolve({ data: null }),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("store_id", store.id).in("status", ["pending", "shipped"]),
  ]);
  const o = ov as Overview | null;
  const pnl = pnlRes.data as Pnl | null;
  const lowCount = Number((lowRes.data as { total_count: number }[] | null)?.[0]?.total_count ?? 0);
  const nearCount = ((nearRes.data as unknown[] | null) ?? []).length;
  const debt = debtRes.data as { overdue_count: number; due_soon_count: number; remaining: number } | null;

  const alerts = [
    lowCount > 0 && { href: `/${store.code}/inventory/low`, text: `${lowCount} sản phẩm dưới mức tồn tối thiểu` },
    nearCount > 0 && { href: `/${store.code}/expiry`, text: `${nearCount} lô sắp hết hạn` },
    (pendingOrders.count ?? 0) > 0 && { href: `/${store.code}/orders`, text: `${pendingOrders.count} đơn online đang chờ giao` },
    debt && debt.overdue_count > 0 && { href: `/${store.code}/payables`, text: `${debt.overdue_count} khoản công nợ quá hạn` },
    debt && debt.due_soon_count > 0 && { href: `/${store.code}/payables`, text: `${debt.due_soon_count} khoản công nợ sắp đến hạn` },
  ].filter(Boolean) as { href: string; text: string }[];

  const cards = [
    ...(pnl
      ? [
          { label: "Doanh thu thuần hôm nay", value: formatMoney(pnl.net_revenue), href: `/${store.code}/reports?preset=today` },
          { label: "Lãi gộp hôm nay", value: formatMoney(pnl.gross_profit), href: `/${store.code}/reports?preset=today` },
        ]
      : []),
    { label: "Mã còn tồn", value: formatNumber(o?.skus_in_stock), href: `/${store.code}/inventory` },
    ...(o?.stock_value != null ? [{ label: "Giá trị tồn (giá vốn)", value: formatMoney(o.stock_value), href: `/${store.code}/inventory` }] : []),
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">{store.name}</h1>
        <p className="text-sm text-muted-foreground">
          Xin chào {ctx.profile.full_name} ({ROLE_LABEL[ctx.profile.role]})
        </p>
      </div>

      {ctx.profile.role !== "accountant" && (
        <div className="flex flex-wrap gap-2">
          {myShift ? (
            <Button className="h-12 px-6 text-base" render={<Link href={`/${store.code}/pos`} />}>
              Bán hàng (ca {myShift.code})
            </Button>
          ) : (
            <Button className="h-12 px-6 text-base" render={<Link href={`/${store.code}/pos`} />}>
              Mở ca và bán hàng
            </Button>
          )}
          <Button variant="outline" className="h-12 px-5" render={<Link href={`/${store.code}/lookup`} />}>
            Tra cứu
          </Button>
          <Button variant="outline" className="h-12 px-5" render={<Link href={`/${store.code}/receipts/new`} />}>
            Nhập hàng
          </Button>
          <Button variant="outline" className="h-12 px-5" render={<Link href={`/${store.code}/orders/new`} />}>
            Đơn online
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="rounded-xl border bg-background p-4 hover:border-primary">
            <div className="text-sm text-muted-foreground">{c.label}</div>
            <div className="text-2xl font-semibold tabular-nums">{c.value}</div>
          </Link>
        ))}
      </div>

      <section className="rounded-xl border bg-background p-4">
        <h2 className="mb-2 font-medium">Cần chú ý</h2>
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Không có cảnh báo nào.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {alerts.map((a) => (
              <li key={a.text}>
                <Link href={a.href} className="underline underline-offset-4">
                  {a.text}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
