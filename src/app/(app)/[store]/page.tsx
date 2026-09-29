import Link from "next/link";
import { requireStore } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { todayVN } from "@/lib/dates";
import { formatMoney, formatNumber } from "@/lib/format";
import { ChipHan, ChipSac, ChipTonKho, ChipTrangThaiDon } from "@/components/ui/chip";
import { HangKpi, KpiCard } from "@/components/ui/kpi-card";
import { ThanhTienDo } from "@/components/ui/thanh-tien-do";
import { CheckCircle2Icon, ChevronRightIcon, PackagePlusIcon, ScanLineIcon, ShoppingCartIcon, TruckIcon } from "lucide-react";

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
    supabase.rpc("inventory_status", { p_store_id: store.id, p_status: ["low", "out"], p_limit: 1 }),
    supabase.rpc("lot_expiry", { p_store_id: store.id, p_status: "near" }),
    isFinance ? supabase.rpc("debt_overview", { p_store_ids: [store.id] }) : Promise.resolve({ data: null }),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("store_id", store.id).in("status", ["pending", "shipped"]),
  ]);
  const o = ov as Overview | null;
  const pnl = pnlRes.data as Pnl | null;
  const lowCount = Number((lowRes.data as { total_count: number }[] | null)?.[0]?.total_count ?? 0);
  const nearCount = ((nearRes.data as unknown[] | null) ?? []).length;
  const debt = debtRes.data as { overdue_count: number; due_soon_count: number; remaining: number } | null;

  // Moi canh bao mang mot chip ngu nghia: ton thap/can date amber, qua han do,
  // cho giao indigo (giu hang). Chu cua chip noi nghia, mau chi bo tro.
  const alerts = [
    lowCount > 0 && { href: `/${store.code}/inventory/low`, text: `${lowCount} sản phẩm dưới mức tồn tối thiểu`, chip: <ChipTonKho ma="thap">Tồn thấp</ChipTonKho> },
    nearCount > 0 && { href: `/${store.code}/expiry`, text: `${nearCount} lô sắp hết hạn`, chip: <ChipHan ma="canDate">Cận date</ChipHan> },
    (pendingOrders.count ?? 0) > 0 && {
      href: `/${store.code}/orders`,
      text: `${pendingOrders.count} đơn online đang chờ giao`,
      chip: <ChipTrangThaiDon ma="giuHang">Chờ giao</ChipTrangThaiDon>,
    },
    debt && debt.overdue_count > 0 && {
      href: `/${store.code}/payables`,
      text: `${debt.overdue_count} khoản công nợ quá hạn`,
      chip: <ChipSac sac="red" dam>Quá hạn</ChipSac>,
    },
    debt && debt.due_soon_count > 0 && {
      href: `/${store.code}/payables`,
      text: `${debt.due_soon_count} khoản công nợ sắp đến hạn`,
      chip: <ChipSac sac="amber">Sắp đến hạn</ChipSac>,
    },
  ].filter(Boolean) as { href: string; text: string; chip: React.ReactNode }[];

  const quick = [
    { href: `/${store.code}/lookup`, label: "Tra cứu", icon: ScanLineIcon },
    { href: `/${store.code}/receipts/new`, label: "Nhập hàng", icon: PackagePlusIcon },
    { href: `/${store.code}/orders/new`, label: "Đơn online", icon: TruckIcon },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-[32px] leading-tight font-bold tracking-wide">Xin chào, {ctx.profile.full_name}</h1>
        <p className="text-sm text-muted-foreground">
          {store.name} - {ROLE_LABEL[ctx.profile.role]}
        </p>
      </div>

      {ctx.profile.role !== "accountant" && (
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)]">
          <Link
            href={`/${store.code}/pos`}
            className="group flex min-h-28 items-center gap-4 rounded-2xl bg-primary p-5 text-primary-foreground shadow-md transition-colors hover:bg-primary-hover focus-visible:ring-4 focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-white/15" aria-hidden>
              <ShoppingCartIcon className="size-7" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-heading text-3xl leading-none font-bold tracking-wide">Bán hàng</span>
              <span className="mt-1 block text-sm text-white/85">{myShift ? `Ca ${myShift.code} đang mở` : "Mở ca và bắt đầu bán"}</span>
            </span>
            <ChevronRightIcon className="size-6 opacity-70 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
          <div className="grid grid-cols-3 gap-3">
            {quick.map((q) => (
              <Link
                key={q.href}
                href={q.href}
                className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border bg-card p-3 text-center text-sm font-medium transition-colors hover:border-primary hover:bg-brand-soft hover:text-brand-strong"
              >
                <q.icon className="size-7 text-brand" aria-hidden />
                {q.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      <HangKpi>
        {pnl && (
          <>
            <KpiCard nhan="Doanh thu thuần hôm nay" giaTri={formatMoney(pnl.net_revenue)} href={`/${store.code}/reports?preset=today`} />
            {/* Lai gop am la tin hieu that (ban duoi gia von), nen to theo dau */}
            <KpiCard
              nhan="Lãi gộp hôm nay"
              giaTri={formatMoney(pnl.gross_profit)}
              href={`/${store.code}/reports?preset=today`}
              sac={pnl.gross_profit < 0 ? "red" : "emerald"}
            />
          </>
        )}
        <KpiCard
          nhan="Mã còn tồn"
          giaTri={formatNumber(o?.skus_in_stock)}
          href={`/${store.code}/inventory`}
          chuGiai="Số mã sản phẩm có tồn lớn hơn 0, so với số mã đang bán"
        >
          <ThanhTienDo
            giaTri={o?.skus_in_stock ?? 0}
            tong={o?.active_products ?? 0}
            donVi="mã"
            nhanAria={`${formatNumber(o?.skus_in_stock)} mã còn tồn trên ${formatNumber(o?.active_products)} mã đang bán`}
          />
        </KpiCard>
        {o?.stock_value != null && <KpiCard nhan="Giá trị tồn (giá vốn)" giaTri={formatMoney(o.stock_value)} href={`/${store.code}/inventory`} />}
      </HangKpi>

      <section className="rounded-2xl border bg-card p-4 lg:p-5" aria-labelledby="alerts-title">
        <h2 id="alerts-title" className="mb-3 font-heading text-2xl font-bold tracking-wide">
          Cần chú ý
        </h2>
        {alerts.length === 0 ? (
          <p className="flex items-center gap-2 rounded-xl bg-success-soft px-4 py-3 text-sm font-medium text-success">
            <CheckCircle2Icon className="size-5" aria-hidden />
            Không có cảnh báo nào.
          </p>
        ) : (
          <ul className="space-y-2">
            {alerts.map((a) => (
              <li key={a.text}>
                <Link
                  href={a.href}
                  className="flex min-h-12 items-center gap-3 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors hover:border-primary hover:bg-brand-soft/60"
                >
                  {a.chip}
                  <span className="flex-1">{a.text}</span>
                  <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
