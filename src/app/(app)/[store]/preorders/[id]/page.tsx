import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateVN, todayVN } from "@/lib/dates";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { ChipSac } from "@/components/ui/chip";
import { ChiSo, HangChiSo } from "@/components/ui/chi-so";
import { Khoi } from "@/components/khoi";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PREORDER_STATUS, accountLabel, type MoneyAccount, type PreorderStatus } from "../labels";
import { HanTra } from "../han-tra";
import { PreorderActions } from "./preorder-actions";

export default async function PreorderPage({ params }: { params: Promise<{ store: string; id: string }> }) {
  const { store: code, id } = await params;
  const { ctx, store } = await requireStore(code);
  const role = ctx.profile.role;
  const seeCost = role !== "staff";
  const supabase = await createClient();
  const { data: o } = await supabase
    .from("preorders")
    .select("id, code, customer_name, customer_phone, ordered_on, due_on, status, subtotal, deposit_type, deposit_value, note, sale_id, cancel_reason, cancel_deposit, arrived_at, delivered_at, cancelled_at, created_at")
    .eq("id", id)
    .eq("store_id", store.id)
    .maybeSingle();
  if (!o) notFound();
  const [{ data: items }, { data: pays }, { data: accounts }, { data: costs }] = await Promise.all([
    supabase.from("preorder_items").select("id, product_id, qty, unit_price").eq("preorder_id", id),
    supabase.from("preorder_payments").select("id, kind, amount, paid_on, account_id, created_at").eq("preorder_id", id).order("created_at"),
    supabase.from("money_accounts").select("id, name, kind, is_active").order("sort_order").order("name"),
    seeCost ? supabase.rpc("preorder_costs", { p_id: id }) : Promise.resolve({ data: [] }),
  ]);
  const itemRows = items ?? [];
  const ids = [...new Set(itemRows.map((i) => i.product_id))];
  const { data: prods } = ids.length ? await supabase.rpc("catalog_by_ids", { p_ids: ids }) : { data: [] };
  const pmap = new Map(
    ((prods ?? []) as { product_id: string; name: string; unit: string }[]).map((p) => [p.product_id, p])
  );
  const cmap = new Map(((costs ?? []) as { item_id: string; unit_cost: number }[]).map((c) => [c.item_id, c.unit_cost]));
  const accRows = (accounts ?? []) as (MoneyAccount & { is_active: boolean })[];
  const amap = new Map(accRows.map((a) => [a.id, a]));
  const payRows = pays ?? [];
  const paid = payRows.reduce((s, p) => s + (p.kind === "deposit" ? p.amount : -p.amount), 0);
  const deposited = payRows.filter((p) => p.kind === "deposit").reduce((s, p) => s + p.amount, 0);
  const costTotal = itemRows.reduce((s, i) => s + Math.round(Number(i.qty) * (cmap.get(i.id) ?? 0)), 0);
  const st = PREORDER_STATUS[o.status as PreorderStatus];
  const active = o.status === "open" || o.status === "arrived";
  const today = todayVN();

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Đặt trước ${o.code}`}
        back={{ href: `/${store.code}/preorders`, label: "Đặt trước" }}
        description={
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <ChipSac sac={st.sac}>{st.label}</ChipSac>
            <HanTra due={o.due_on} status={o.status} today={today} />
            <ChipSac sac="slate">Đặt {formatDateVN(o.ordered_on)}</ChipSac>
            <ChipSac sac="slate">Hẹn trả {formatDateVN(o.due_on)}</ChipSac>
          </span>
        }
        actions={
          role !== "accountant" && (
            <PreorderActions
              storeCode={store.code}
              id={o.id}
              code={o.code}
              status={o.status}
              subtotal={o.subtotal}
              paid={paid}
              accounts={accRows.filter((a) => a.is_active)}
              today={today}
              isManager={role === "sadmin" || role === "admin"}
            />
          )
        }
      />
      {o.cancel_reason && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm">
          Lý do hủy: {o.cancel_reason}
          {o.cancel_deposit && ` - ${o.cancel_deposit === "refund" ? "đã hoàn cọc cho khách" : "giữ cọc, ghi thu nhập khác"}`}
        </p>
      )}

      <HangChiSo className={seeCost ? "lg:grid-cols-4" : "lg:grid-cols-3"}>
        <ChiSo nhan={o.status === "cancelled" ? "Tiền hàng - đã hủy" : "Tiền hàng"} sac={o.status === "cancelled" ? "red" : "brand"} giaTri={formatMoney(o.subtotal)} />
        <ChiSo
          nhan="Đã cọc"
          sac={deposited ? "emerald" : "slate"}
          giaTri={formatMoney(deposited)}
          phu={
            o.deposit_type === "percent" && o.deposit_value
              ? `Thỏa thuận ${formatNumber(Number(o.deposit_value))}% tiền hàng`
              : o.subtotal > 0 && deposited > 0
                ? `${((deposited / o.subtotal) * 100).toFixed(1).replace(".", ",")}% tiền hàng`
                : undefined
          }
        />
        <ChiSo nhan={active ? "Còn phải thu" : "Còn lại"} sac={active && o.subtotal - paid > 0 ? "amber" : "slate"} giaTri={active ? formatMoney(o.subtotal - paid) : "-"} />
        {seeCost && (
          <ChiSo
            nhan="Lãi dự kiến"
            sac="brand"
            giaTri={formatMoney(o.subtotal - costTotal)}
            phu={`Giá vốn ${formatMoney(costTotal)}${o.sale_id ? " - lãi thật xem ở giao dịch bán" : ""}`}
          />
        )}
      </HangChiSo>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <Khoi title={`Sản phẩm (${itemRows.length})`} className="min-w-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sản phẩm</TableHead>
                  <TableHead className="text-right">SL</TableHead>
                  {seeCost && <TableHead className="text-right">Giá vốn</TableHead>}
                  <TableHead className="text-right">Giá bán</TableHead>
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
                        {formatNumber(Number(i.qty))} {p?.unit}
                      </TableCell>
                      {seeCost && <TableCell className="text-right tabular-nums">{formatMoney(cmap.get(i.id) ?? 0)}</TableCell>}
                      <TableCell className="text-right tabular-nums">{formatMoney(i.unit_price)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(Math.round(Number(i.qty) * i.unit_price))}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Khoi>

        <div className="min-w-0 space-y-4">
          <Khoi title="Khách hàng" className="text-sm">
            <p className="font-medium">{o.customer_name}</p>
            <p>{o.customer_phone ? <a href={`tel:${o.customer_phone}`} className="underline underline-offset-4">{o.customer_phone}</a> : "-"}</p>
            {o.note && <p className="mt-2">Ghi chú: {o.note}</p>}
            <p className="mt-2 text-xs text-muted-foreground">
              Tạo lúc {formatDateTime(o.created_at)}
              {o.arrived_at && ` - hàng về ${formatDateTime(o.arrived_at)}`}
              {o.delivered_at && ` - giao ${formatDateTime(o.delivered_at)}`}
              {o.cancelled_at && ` - hủy ${formatDateTime(o.cancelled_at)}`}
            </p>
          </Khoi>

          <Khoi title="Tiền cọc" className="text-sm">
            {payRows.length === 0 ? (
              <p className="text-muted-foreground">Chưa nhận cọc.</p>
            ) : (
              <ul className="space-y-1.5">
                {payRows.map((p) => {
                  const a = amap.get(p.account_id);
                  return (
                    <li key={p.id} className="flex items-start justify-between gap-3">
                      <span>
                        {p.kind === "deposit" ? "Cọc" : "Hoàn cọc"} {formatDateVN(p.paid_on)}
                        <span className="block text-xs text-muted-foreground">{a ? accountLabel(a) : ""}</span>
                      </span>
                      <span className={`tabular-nums ${p.kind === "refund" ? "text-chu-red" : ""}`}>
                        {p.kind === "refund" ? "-" : ""}
                        {formatMoney(p.amount)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            {o.sale_id && (
              <Link href={`/${store.code}/sales/${o.sale_id}`} className="mt-3 block underline underline-offset-4">
                Xem giao dịch bán đã ghi nhận
              </Link>
            )}
          </Khoi>
        </div>
      </div>
    </div>
  );
}
