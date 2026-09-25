import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CHANNEL_LABEL, SALE_STATUS } from "../labels";
import { PAYMENT_METHOD_LABEL } from "../../receipts/labels";
import { CancelSaleButton } from "./cancel-button";

export default async function SalePage({ params }: { params: Promise<{ store: string; id: string }> }) {
  const { store: code, id } = await params;
  const { ctx, store } = await requireStore(code);
  const supabase = await createClient();
  const { data: s } = await supabase
    .from("sales")
    .select(
      "id, code, shift_id, channel, order_id, status, subtotal, discount_amount, total, completed_at, cancel_reason, cancelled_at, note, creator:created_by(full_name), approver:discount_approved_by(full_name), canceller:cancelled_by(full_name), shifts(code, user_id, status)"
    )
    .eq("id", id)
    .eq("store_id", store.id)
    .maybeSingle();
  if (!s) notFound();
  const [{ data: items }, { data: payments }] = await Promise.all([
    supabase.from("sale_items").select("id, line_no, product_id, qty, unit_price, discount_amount, line_total").eq("sale_id", id).order("line_no"),
    supabase.from("sale_payments").select("id, method, amount, reference").eq("sale_id", id),
  ]);
  const ids = [...new Set((items ?? []).map((i) => i.product_id))];
  const { data: prods } = ids.length ? await supabase.rpc("catalog_by_ids", { p_ids: ids }) : { data: [] };
  const pmap = new Map(((prods ?? []) as { product_id: string; name: string; sku: string; unit: string }[]).map((p) => [p.product_id, p]));
  const st = SALE_STATUS[s.status as keyof typeof SALE_STATUS];
  const shift = s.shifts as unknown as { code: string; user_id: string; status: string } | null;
  const isManager = ctx.profile.role === "sadmin" || ctx.profile.role === "admin";
  const canCancel =
    s.status === "completed" &&
    (isManager || (ctx.profile.role === "staff" && shift?.user_id === ctx.profile.id && shift?.status === "open"));

  return (
    <div className="max-w-4xl space-y-4">
      <PageHeader
        title={`Hóa đơn ${s.code}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant={st.variant}>{st.label}</Badge>
            {CHANNEL_LABEL[s.channel as keyof typeof CHANNEL_LABEL]} - {formatDateTime(s.completed_at)} -{" "}
            {(s.creator as unknown as { full_name: string } | null)?.full_name}
            {shift && (
              <>
                {" "}- ca{" "}
                <Link href={`/${store.code}/shifts/${s.shift_id}`} className="underline underline-offset-4">
                  {shift.code}
                </Link>
              </>
            )}
          </span>
        }
        actions={
          <>
            <Button variant="outline" render={<Link href={`/print/receipt/${s.id}`} target="_blank" />}>
              In lại hóa đơn
            </Button>
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
      <div className="overflow-x-auto rounded-xl border bg-card">
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
      <div className="ml-auto max-w-sm rounded-xl border bg-card p-4 text-sm">
        <dl className="grid grid-cols-2 gap-y-1">
          <dt>Tiền hàng</dt>
          <dd className="text-right tabular-nums">{formatMoney(s.subtotal)}</dd>
          <dt>Giảm giá</dt>
          <dd className="text-right tabular-nums">-{formatMoney(s.discount_amount)}</dd>
          <dt className="text-base font-semibold">Tổng</dt>
          <dd className="text-right text-base font-semibold tabular-nums">{formatMoney(s.total)}</dd>
          {(payments ?? []).map((p) => (
            <div key={p.id} className="contents">
              <dt className="text-muted-foreground">{PAYMENT_METHOD_LABEL[p.method as keyof typeof PAYMENT_METHOD_LABEL]}</dt>
              <dd className="text-right tabular-nums text-muted-foreground">{formatMoney(p.amount)}</dd>
            </div>
          ))}
        </dl>
        {s.approver && (
          <p className="mt-2 text-xs text-muted-foreground">
            Giảm giá vượt hạn mức được duyệt bởi {(s.approver as unknown as { full_name: string }).full_name}
          </p>
        )}
      </div>
    </div>
  );
}
