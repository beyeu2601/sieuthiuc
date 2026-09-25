import Link from "next/link";
import { notFound } from "next/navigation";
import { hasPerm, requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { GOODS_TYPE_LABEL } from "@/lib/text";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReceiptEditor, type EditorLine } from "../receipt-editor";
import { RECEIPT_STATUS, PAYMENT_METHOD_LABEL } from "../labels";

type Item = {
  id: string;
  line_no: number;
  product_id: string;
  goods_type: "cont" | "air";
  qty: number;
  unit: string;
  unit_cost: number;
  line_total: number;
  allocated_cost: number;
  landed_unit_cost: number | null;
  lot_no: string | null;
  expiry_date: string | null;
  products: { name: string; sku: string; expiry_level: "none" | "product" | "lot" } | null;
};

export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ store: string; id: string }>;
  searchParams: Promise<{ confirm?: string }>;
}) {
  const { store: code, id } = await params;
  const { confirm } = await searchParams;
  const { ctx, store } = await requireStore(code);
  const supabase = await createClient();

  const { data: r } = await supabase
    .from("purchase_receipts")
    .select(
      "id, code, store_id, supplier_id, receipt_date, invoice_no, status, subtotal, extra_cost_total, total, paid_amount, payment_method, due_date, note, confirmed_at, cancel_reason, created_at, suppliers(name, code), confirmer:confirmed_by(full_name), creator:created_by(full_name)"
    )
    .eq("id", id)
    .eq("store_id", store.id)
    .maybeSingle();
  if (!r) notFound();

  const [{ data: items }, { data: costs }] = await Promise.all([
    supabase
      .from("purchase_receipt_items")
      .select("id, line_no, product_id, goods_type, qty, unit, unit_cost, line_total, allocated_cost, landed_unit_cost, lot_no, expiry_date")
      .eq("receipt_id", id)
      .order("line_no"),
    supabase.from("purchase_receipt_costs").select("id, cost_type, amount, allocation, note").eq("receipt_id", id),
  ]);
  // ten san pham qua RPC an toan (nhan vien khong doc bang products)
  const ids = [...new Set((items ?? []).map((i) => i.product_id))];
  const { data: prods } = ids.length ? await supabase.rpc("catalog_by_ids", { p_ids: ids }) : { data: [] };
  const pmap = new Map(((prods ?? []) as { product_id: string; name: string; sku: string; expiry_level: "none" | "product" | "lot" }[]).map((p) => [p.product_id, p]));
  const rows: Item[] = (items ?? []).map((i) => ({ ...i, products: pmap.get(i.product_id) ?? null }));
  const supplier = r.suppliers as unknown as { name: string; code: string } | null;
  const canEdit = ctx.profile.role !== "accountant";
  const canConfirm = ["sadmin", "admin"].includes(ctx.profile.role) || (ctx.profile.role === "staff" && hasPerm(ctx, "confirm_receipt"));

  if (r.status === "draft" && canEdit) {
    const { data: suppliers } = await supabase
      .from("suppliers")
      .select("id, code, name, payment_terms_days")
      .or(`is_active.eq.true,id.eq.${r.supplier_id}`)
      .order("name");
    const lines: EditorLine[] = rows.map((i) => ({
      key: i.id,
      product_id: i.product_id,
      name: i.products?.name ?? "?",
      sku: i.products?.sku ?? "",
      unit: i.unit,
      goods_type: i.goods_type,
      expiry_level: i.products?.expiry_level ?? "lot",
      qty: Number(i.qty),
      unit_cost: i.unit_cost,
      lot_no: i.lot_no ?? "",
      expiry_date: i.expiry_date ?? "",
    }));
    return (
      <div>
        <PageHeader title={`Phiếu nhập ${r.code}`} description={<Badge variant="outline">Nháp</Badge>} />
        <ReceiptEditor
          storeId={store.id}
          storeCode={store.code}
          receiptId={r.id}
          suppliers={suppliers ?? []}
          canConfirm={canConfirm}
          autoOpenConfirm={confirm === "1"}
          initial={{
            supplier_id: r.supplier_id,
            receipt_date: r.receipt_date,
            invoice_no: r.invoice_no ?? "",
            due_date: r.due_date ?? "",
            note: r.note ?? "",
            lines,
            costs: (costs ?? []).map((c) => ({
              key: c.id,
              cost_type: c.cost_type,
              amount: c.amount,
              allocation: c.allocation as "by_value" | "by_qty",
              note: c.note ?? "",
            })),
          }}
        />
      </div>
    );
  }

  const st = RECEIPT_STATUS[r.status as keyof typeof RECEIPT_STATUS];
  const remaining = r.total - r.paid_amount;
  return (
    <div className="space-y-4">
      <PageHeader
        title={`Phiếu nhập ${r.code}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant={st.variant}>{st.label}</Badge>
            {supplier?.name} - ngày {new Date(r.receipt_date).toLocaleDateString("vi-VN")}
            {r.invoice_no ? ` - HĐ ${r.invoice_no}` : ""}
          </span>
        }
      />
      {r.status === "cancelled" && (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm">Đã hủy. Lý do: {r.cancel_reason}</p>
      )}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead className="min-w-56">Sản phẩm</TableHead>
              <TableHead className="text-right">SL</TableHead>
              <TableHead className="text-right">Đơn giá</TableHead>
              <TableHead className="text-right">Thành tiền</TableHead>
              <TableHead className="text-right">CP phân bổ</TableHead>
              <TableHead className="text-right">Giá vốn nhập</TableHead>
              <TableHead>Lô</TableHead>
              <TableHead>HSD</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((i) => (
              <TableRow key={i.id}>
                <TableCell>{i.line_no}</TableCell>
                <TableCell className="min-w-56 whitespace-normal">
                  {i.products?.name}
                  <div className="text-xs text-muted-foreground">
                    {i.products?.sku} - {GOODS_TYPE_LABEL[i.goods_type]}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(i.qty)} {i.unit}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(i.unit_cost)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(i.line_total)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(i.allocated_cost)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(i.landed_unit_cost)}</TableCell>
                <TableCell>{i.lot_no ?? r.code}</TableCell>
                <TableCell>{i.expiry_date ? new Date(i.expiry_date).toLocaleDateString("vi-VN") : "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-4 text-sm">
          <dl className="grid grid-cols-2 gap-y-1">
            <dt>Tiền hàng</dt>
            <dd className="text-right tabular-nums">{formatMoney(r.subtotal)}</dd>
            <dt>Chi phí kèm theo</dt>
            <dd className="text-right tabular-nums">{formatMoney(r.extra_cost_total)}</dd>
            <dt className="font-medium">Tổng phiếu</dt>
            <dd className="text-right font-medium tabular-nums">{formatMoney(r.total)}</dd>
            {r.status === "confirmed" && (
              <>
                <dt>Đã trả</dt>
                <dd className="text-right tabular-nums">
                  {formatMoney(r.paid_amount)}
                  {r.payment_method ? ` (${PAYMENT_METHOD_LABEL[r.payment_method as keyof typeof PAYMENT_METHOD_LABEL]})` : ""}
                </dd>
                <dt>Còn nợ</dt>
                <dd className="text-right tabular-nums">{formatMoney(remaining)}</dd>
                {remaining > 0 && r.due_date && (
                  <>
                    <dt>Hạn thanh toán</dt>
                    <dd className="text-right">{new Date(r.due_date).toLocaleDateString("vi-VN")}</dd>
                  </>
                )}
              </>
            )}
          </dl>
          {r.status === "confirmed" && remaining > 0 && ctx.profile.role !== "staff" && (
            <Link href={`/${store.code}/payables`} className="mt-2 inline-block text-sm underline underline-offset-4">
              Xem công nợ
            </Link>
          )}
        </div>
        <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          <p>Người tạo: {(r.creator as unknown as { full_name: string } | null)?.full_name ?? "-"} - {formatDateTime(r.created_at)}</p>
          {r.confirmed_at && (
            <p>
              Xác nhận: {(r.confirmer as unknown as { full_name: string } | null)?.full_name ?? "-"} - {formatDateTime(r.confirmed_at)}
            </p>
          )}
          {r.note && <p className="mt-2 text-foreground">Ghi chú: {r.note}</p>}
          {r.status === "confirmed" && (
            <p className="mt-2">Phiếu đã xác nhận không sửa được. Sai số lượng thì dùng phiếu điều chỉnh tồn kho.</p>
          )}
        </div>
      </div>
    </div>
  );
}
