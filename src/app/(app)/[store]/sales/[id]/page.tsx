import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { ChipSac, sacKenhBan } from "@/components/ui/chip";
import { ChiSo, HangChiSo } from "@/components/ui/chi-so";
import { Khoi } from "@/components/khoi";
import { MobileCard, MobileCardList } from "@/components/mobile-card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CHANNEL_LABEL, SALE_STATUS } from "../labels";
import { PAYMENT_METHOD_LABEL } from "../../receipts/labels";
import { CancelSaleButton } from "./cancel-button";
import { EditSale, type SaleEditValues } from "./edit-sale";
import { CollectDebtButton, type MoneyAccount } from "../collect-debt";
import { todayVN } from "@/lib/dates";

export default async function SalePage({ params }: { params: Promise<{ store: string; id: string }> }) {
  const { store: code, id } = await params;
  const { ctx, store } = await requireStore(code);
  const supabase = await createClient();
  const { data: s } = await supabase
    .from("sales")
    .select(
      "id, code, shift_id, channel, order_id, status, subtotal, discount_amount, discount_note, total, completed_at, cancel_reason, created_by, cancelled_at, note, creator:created_by(full_name), approver:discount_approved_by(full_name), canceller:cancelled_by(full_name), shifts(code, user_id, status)"
    )
    .eq("id", id)
    .eq("store_id", store.id)
    .maybeSingle();
  if (!s) notFound();
  const [{ data: items }, { data: payments }, { data: debt }, { data: accountRows }] = await Promise.all([
    supabase.from("sale_items").select("id, line_no, product_id, qty, unit_price, discount_amount, line_total").eq("sale_id", id).order("line_no"),
    supabase.from("sale_payments").select("id, method, amount, reference, account_id").eq("sale_id", id),
    supabase
      .from("customer_debts")
      .select("id, code, customer_name, customer_phone, amount, paid_amount, remaining, customer_debt_payments(id, amount, paid_on, money_accounts(name))")
      .eq("sale_id", id)
      .maybeSingle(),
    supabase.from("money_accounts").select("id, name, kind").eq("is_active", true).order("sort_order").order("name"),
  ]);
  const accounts = (accountRows ?? []) as MoneyAccount[];
  const debtPayments = (debt?.customer_debt_payments ?? []) as unknown as { id: string; amount: number; paid_on: string; money_accounts: { name: string } | null }[];
  const ids = [...new Set((items ?? []).map((i) => i.product_id))];
  const { data: prods } = ids.length ? await supabase.rpc("catalog_by_ids", { p_ids: ids }) : { data: [] };
  const pmap = new Map(((prods ?? []) as { product_id: string; name: string; sku: string; unit: string }[]).map((p) => [p.product_id, p]));
  const st = SALE_STATUS[s.status as keyof typeof SALE_STATUS];
  const shift = s.shifts as unknown as { code: string; user_id: string; status: string } | null;
  const isManager = ctx.profile.role === "sadmin" || ctx.profile.role === "admin";
  const canCancel =
    s.status === "completed" &&
    // Khop cancel_sale: nhan vien huy giao dich cua minh trong ca dang mo
    (isManager || (ctx.profile.role === "staff" && s.created_by === ctx.profile.id && shift?.status === "open"));
  const approverName = (s.approver as unknown as { full_name: string } | null)?.full_name;
  const lineCount = (items ?? []).length;
  // Khop update_sale: ban tai quay, ca con mo; nhan vien chi sua giao dich cua minh
  const canEdit =
    s.status === "completed" &&
    s.channel === "pos" &&
    shift?.status === "open" &&
    (isManager || (ctx.profile.role === "staff" && s.created_by === ctx.profile.id));
  const isDebtPay = (p: { reference: string | null }) => p.reference === "Ghi nợ";
  const lineDiscount = (items ?? []).reduce((t, i) => t + (i.discount_amount ?? 0), 0);
  const payOf = (m: "cash" | "transfer" | "other") => {
    const ps = (payments ?? []).filter((p) => p.method === m && !isDebtPay(p));
    return { amount: ps.length ? ps.reduce((t, p) => t + p.amount, 0) : null, account: ps[0]?.account_id ?? "" };
  };
  const editValues: SaleEditValues = {
    orderDiscount: s.discount_amount - lineDiscount,
    discountNote: s.discount_note ?? "",
    note: s.note ?? "",
    pay: { cash: payOf("cash"), transfer: payOf("transfer"), other: payOf("other") },
    debt: debt?.amount ?? null,
    debtName: debt?.customer_name ?? "",
    debtPhone: debt?.customer_phone ?? "",
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Hóa đơn ${s.code}`}
        description={
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <ChipSac sac={st.sac}>{st.label}</ChipSac>
            <ChipSac sac={sacKenhBan(s.channel)}>{CHANNEL_LABEL[s.channel as keyof typeof CHANNEL_LABEL]}</ChipSac>
            <ChipSac sac="slate">{formatDateTime(s.completed_at)}</ChipSac>
            <ChipSac sac="slate">{(s.creator as unknown as { full_name: string } | null)?.full_name ?? "-"}</ChipSac>
            {shift && (
              <Link href={`/${store.code}/shifts/${s.shift_id}`} className="rounded-full underline-offset-4 hover:underline">
                <ChipSac sac="slate" className="font-mono">
                  Ca {shift.code}
                </ChipSac>
              </Link>
            )}
          </span>
        }
        actions={
          <>
            <Button variant="outline" render={<Link href={`/print/receipt/${s.id}`} target="_blank" />}>
              In lại hóa đơn
            </Button>
            {canEdit && (
              <EditSale
                storeCode={store.code}
                sale={{ id: s.id, code: s.code, subtotal: s.subtotal, lineDiscount, debtPaid: debt?.paid_amount ?? 0, values: editValues }}
                accounts={accounts}
              />
            )}
            {canCancel && <CancelSaleButton storeCode={store.code} saleId={s.id} />}
          </>
        }
      />
      {s.status === "cancelled" && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm">
          Đã hủy lúc {formatDateTime(s.cancelled_at)} bởi {(s.canceller as unknown as { full_name: string } | null)?.full_name}. Lý do:{" "}
          {s.cancel_reason}
        </p>
      )}

      <HangChiSo className="lg:grid-cols-3">
        <ChiSo
          nhan={s.status === "cancelled" ? "Tổng - đã hủy, không tính doanh thu" : "Tổng thanh toán"}
          sac={s.status === "cancelled" ? "red" : "brand"}
          giaTri={formatMoney(s.total)}
          phu={`Tiền hàng ${formatMoney(s.subtotal)}`}
        />
        <ChiSo
          nhan={s.discount_amount ? (approverName ? "Giảm giá vượt hạn mức" : "Giảm giá") : "Không giảm giá"}
          sac={s.discount_amount ? "amber" : "slate"}
          giaTri={s.discount_amount ? formatMoney(s.discount_amount) : "-"}
          phu={
            [
              approverName
                ? `Duyệt bởi ${approverName}`
                : s.discount_amount && s.subtotal > 0
                  ? `${Math.round((s.discount_amount / s.subtotal) * 100)}% tiền hàng`
                  : null,
              s.discount_note,
            ]
              .filter(Boolean)
              .join(" - ") || undefined
          }
        />
        <ChiSo nhan="Dòng hàng" sac="brand" giaTri={lineCount} />
      </HangChiSo>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0">
          <MobileCardList label="Dòng hàng">
            {(items ?? []).map((i) => {
              const p = pmap.get(i.product_id);
              return (
                <MobileCard
                  key={i.id}
                  title={`${i.line_no}. ${p?.name ?? ""}`}
                  subtitle={p?.sku}
                  stats={[
                    { label: "SL", value: `${formatNumber(i.qty)} ${p?.unit ?? ""}` },
                    { label: "Đơn giá", value: formatMoney(i.unit_price) },
                    { label: "Thành tiền", value: formatMoney(i.line_total), strong: true },
                    ...(i.discount_amount ? [{ label: "Giảm", value: formatMoney(i.discount_amount) }] : []),
                  ]}
                />
              );
            })}
          </MobileCardList>
          <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead className="min-w-56">Sản phẩm</TableHead>
                <TableHead className="text-right">SL</TableHead>
                <TableHead className="text-right">Đơn giá</TableHead>
                <TableHead className="text-right">Giảm</TableHead>
                <TableHead className="text-right">Thành tiền</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(items ?? []).map((i) => {
                const p = pmap.get(i.product_id);
                return (
                  <TableRow key={i.id}>
                    <TableCell>{i.line_no}</TableCell>
                    <TableCell className="min-w-56 whitespace-normal">
                      {p?.name}
                      <div className="text-xs text-muted-foreground">{p?.sku}</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(i.qty)} {p?.unit}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(i.unit_price)}</TableCell>
                    <TableCell className="text-right tabular-nums">{i.discount_amount ? formatMoney(i.discount_amount) : "-"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(i.line_total)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <Khoi title="Thanh toán" className="text-sm">
            <dl className="grid grid-cols-2 gap-y-1">
              <dt>Tiền hàng</dt>
              <dd className="text-right tabular-nums">{formatMoney(s.subtotal)}</dd>
              <dt>Giảm giá</dt>
              <dd className="text-right tabular-nums">-{formatMoney(s.discount_amount)}</dd>
              <dt className="text-base font-semibold">Tổng</dt>
              <dd className="text-right text-base font-semibold tabular-nums">{formatMoney(s.total)}</dd>
              {(payments ?? []).map((p) => (
                <div key={p.id} className="contents">
                  <dt className="text-muted-foreground">
                    {isDebtPay(p) ? "Ghi nợ" : PAYMENT_METHOD_LABEL[p.method as keyof typeof PAYMENT_METHOD_LABEL]}
                  </dt>
                  <dd className="text-right tabular-nums text-muted-foreground">{formatMoney(p.amount)}</dd>
                </div>
              ))}
            </dl>
            {s.note && <p className="mt-2 border-t pt-2 text-muted-foreground whitespace-pre-line">{s.note}</p>}
          </Khoi>

        {debt && (
          <Khoi
            title={`Khách nợ: ${debt.customer_name}`}
            className="text-sm"
            aside={
              debt.remaining > 0 && s.status === "completed" ? (
                <CollectDebtButton storeCode={store.code} debt={debt} accounts={accounts} today={todayVN()} size="sm" />
              ) : (
                <ChipSac sac={debt.remaining > 0 ? "amber" : "emerald"}>{debt.remaining > 0 ? "Còn nợ" : "Đã trả đủ"}</ChipSac>
              )
            }
          >
            <dl className="grid grid-cols-2 gap-y-1 tabular-nums">
              <dt className="text-muted-foreground">
                {debt.code}
                {debt.customer_phone ? ` - ${debt.customer_phone}` : ""}
              </dt>
              <dd className="text-right">Ghi nợ {formatMoney(debt.amount)}</dd>
              {debtPayments.map((p) => (
                <div key={p.id} className="contents text-muted-foreground">
                  <dt>
                    Thu {new Date(`${p.paid_on}T00:00:00`).toLocaleDateString("vi-VN")}
                    {p.money_accounts ? ` - ${p.money_accounts.name}` : ""}
                  </dt>
                  <dd className="text-right">-{formatMoney(p.amount)}</dd>
                </div>
              ))}
              <dt className="font-medium">Còn nợ</dt>
              <dd className={`text-right font-semibold ${debt.remaining > 0 ? "text-chu-amber" : ""}`}>{formatMoney(debt.remaining)}</dd>
            </dl>
          </Khoi>
        )}
        </div>
      </div>
    </div>
  );
}
