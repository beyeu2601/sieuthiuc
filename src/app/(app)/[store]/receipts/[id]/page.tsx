import Link from "next/link";
import { notFound } from "next/navigation";
import { hasPerm, requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { formatDateVN, todayVN } from "@/lib/dates";
import { GOODS_TYPE_LABEL } from "@/lib/text";
import { MobileCard, MobileCardList } from "@/components/mobile-card";
import { PageHeader } from "@/components/page-header";
import { Khoi } from "@/components/khoi";
import { ChipSac, type SacNguNghia } from "@/components/ui/chip";
import { ChiSo, HangChiSo } from "@/components/ui/chi-so";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReceiptEditor, type EditorLine } from "../receipt-editor";
import { ReopenButton } from "../reopen-button";
import { ALLOCATION_LABEL, COST_TYPE_LABEL, RECEIPT_STATUS, PAYMENT_METHOD_LABEL } from "../labels";

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
  sell_price: number | null;
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
      .select("id, line_no, product_id, goods_type, qty, unit, unit_cost, line_total, allocated_cost, landed_unit_cost, lot_no, expiry_date, sell_price")
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
    const [{ data: suppliers }, { data: accounts }] = await Promise.all([
      supabase
        .from("suppliers")
        .select("id, code, name, payment_terms_days")
        .or(`is_active.eq.true,id.eq.${r.supplier_id}`)
        .order("name"),
      supabase.from("money_accounts").select("id, name, kind").eq("is_active", true).order("sort_order").order("name"),
    ]);
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
      sell_price: i.sell_price,
    }));
    return (
      <div>
        <PageHeader title={`Phiếu nhập ${r.code}`} description={<ChipSac sac="slate">Nháp</ChipSac>} />
        <ReceiptEditor
          storeId={store.id}
          storeCode={store.code}
          receiptId={r.id}
          suppliers={suppliers ?? []}
          accounts={(accounts ?? []) as { id: string; name: string; kind: string }[]}
          canCreateProduct={["sadmin", "admin"].includes(ctx.profile.role)}
          canCreateSupplier={["sadmin", "admin", "accountant"].includes(ctx.profile.role)}
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
  const canReopen = r.status === "confirmed" && ["sadmin", "admin"].includes(ctx.profile.role);
  const confirmed = r.status === "confirmed";
  const overdue = confirmed && remaining > 0 && !!r.due_date && String(r.due_date).slice(0, 10) < todayVN();
  const debtSac: SacNguNghia = !confirmed ? "slate" : remaining <= 0 ? "emerald" : overdue ? "red" : "amber";
  const costRows = costs ?? [];
  const productCount = ids.length;
  const methodLabel = r.payment_method ? PAYMENT_METHOD_LABEL[r.payment_method as keyof typeof PAYMENT_METHOD_LABEL] : null;
  const creator = (r.creator as unknown as { full_name: string } | null)?.full_name ?? "-";
  const confirmer = (r.confirmer as unknown as { full_name: string } | null)?.full_name ?? "-";

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Phiếu nhập ${r.code}`}
        description={
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <ChipSac sac={st.sac}>{st.label}</ChipSac>
            {supplier && <ChipSac sac="slate">{supplier.name}</ChipSac>}
            <ChipSac sac="slate">Ngày {formatDateVN(r.receipt_date)}</ChipSac>
            {r.invoice_no && <ChipSac sac="slate">HĐ {r.invoice_no}</ChipSac>}
            {overdue && (
              <ChipSac sac="red" dam>
                Quá hạn trả
              </ChipSac>
            )}
          </span>
        }
        actions={canReopen ? <ReopenButton storeCode={store.code} receiptId={r.id} /> : undefined}
      />
      {r.status === "cancelled" && (
        <p className="rounded-lg border border-vien-red bg-nen-red px-3 py-2 text-sm text-chu-red">Đã hủy. Lý do: {r.cancel_reason}</p>
      )}

      <HangChiSo>
        <ChiSo
          nhan="Tổng phiếu"
          sac="brand"
          giaTri={formatMoney(r.total)}
          phu={`Hàng ${formatMoney(r.subtotal)} + chi phí ${formatMoney(r.extra_cost_total)}`}
        />
        <ChiSo
          nhan={!confirmed ? "Công nợ" : remaining <= 0 ? "Đã trả đủ" : overdue ? "Còn nợ: quá hạn" : "Còn nợ"}
          sac={debtSac}
          giaTri={confirmed ? formatMoney(remaining) : "-"}
          phu={
            !confirmed
              ? r.status === "cancelled"
                ? "Phiếu đã hủy"
                : "Chưa nhập kho"
              : `Đã trả ${formatMoney(r.paid_amount)}${methodLabel ? ` (${methodLabel})` : ""}${remaining > 0 && r.due_date ? ` - hạn ${formatDateVN(r.due_date)}` : ""}`
          }
        />
        <ChiSo nhan="Dòng hàng" sac="slate" giaTri={formatNumber(rows.length)} phu={`${formatNumber(productCount)} sản phẩm`} />
      </HangChiSo>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="min-w-0 rounded-xl border bg-card p-4">
          <Tabs defaultValue="items">
            <TabsList>
              <TabsTrigger value="items" className="px-3">
                Dòng hàng ({rows.length})
              </TabsTrigger>
              <TabsTrigger value="costs" className="px-3">
                Chi phí kèm theo ({costRows.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="items" className="pt-2">
              <MobileCardList label="Dòng hàng">
                {rows.map((i) => (
                  <MobileCard
                    key={i.id}
                    title={`${i.line_no}. ${i.products?.name ?? ""}`}
                    subtitle={`${i.products?.sku} - ${GOODS_TYPE_LABEL[i.goods_type]} - Lô ${i.lot_no ?? r.code}`}
                    stats={[
                      { label: "SL", value: `${formatNumber(i.qty)} ${i.unit}`, strong: true },
                      { label: "Đơn giá", value: formatMoney(i.unit_cost) },
                      { label: "Thành tiền", value: formatMoney(i.line_total) },
                      { label: "CP phân bổ", value: formatMoney(i.allocated_cost) },
                      { label: "Giá vốn nhập", value: formatMoney(i.landed_unit_cost) },
                      { label: "HSD", value: i.expiry_date ? new Date(i.expiry_date).toLocaleDateString("vi-VN") : "-" },
                    ]}
                  />
                ))}
              </MobileCardList>
              <div className="hidden overflow-x-auto md:block">
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
            </TabsContent>
            <TabsContent value="costs" className="pt-2">
              {costRows.length === 0 ? (
                <p className="py-4 text-muted-foreground">Không có chi phí kèm theo.</p>
              ) : (
                <ul className="divide-y">
                  {costRows.map((c) => (
                    <li key={c.id} className="flex items-baseline justify-between gap-3 py-2">
                      <span className="min-w-0">
                        {COST_TYPE_LABEL[c.cost_type] ?? c.cost_type}
                        <span className="block text-xs text-muted-foreground">
                          Phân bổ {(ALLOCATION_LABEL[c.allocation] ?? c.allocation).toLowerCase()}
                          {c.note ? ` - ${c.note}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums">{formatMoney(c.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </section>

        <div className="min-w-0 space-y-4">
          <Khoi title="Thanh toán">
            <dl className="grid grid-cols-2 gap-y-1 text-sm">
              <dt>Tiền hàng</dt>
              <dd className="text-right tabular-nums">{formatMoney(r.subtotal)}</dd>
              <dt>Chi phí kèm theo</dt>
              <dd className="text-right tabular-nums">{formatMoney(r.extra_cost_total)}</dd>
              <dt className="font-medium">Tổng phiếu</dt>
              <dd className="text-right font-medium tabular-nums">{formatMoney(r.total)}</dd>
              {confirmed && (
                <>
                  <dt>Đã trả</dt>
                  <dd className="text-right tabular-nums">
                    {formatMoney(r.paid_amount)}
                    {methodLabel ? ` (${methodLabel})` : ""}
                  </dd>
                  <dt>Còn nợ</dt>
                  <dd className="text-right tabular-nums">{formatMoney(remaining)}</dd>
                  {remaining > 0 && r.due_date && (
                    <>
                      <dt>Hạn thanh toán</dt>
                      <dd className={overdue ? "text-right font-medium text-chu-red" : "text-right"}>{formatDateVN(r.due_date)}</dd>
                    </>
                  )}
                </>
              )}
            </dl>
            {confirmed && remaining > 0 && ctx.profile.role !== "staff" && (
              <Link href={`/${store.code}/payables`} className="mt-2 inline-block text-sm underline underline-offset-4">
                Xem công nợ
              </Link>
            )}
          </Khoi>

          <Khoi title="Thông tin">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Người tạo</dt>
              <dd className="text-right">
                {creator}
                <span className="block text-xs text-muted-foreground">{formatDateTime(r.created_at)}</span>
              </dd>
              {r.confirmed_at && (
                <>
                  <dt className="text-muted-foreground">Xác nhận</dt>
                  <dd className="text-right">
                    {confirmer}
                    <span className="block text-xs text-muted-foreground">{formatDateTime(r.confirmed_at)}</span>
                  </dd>
                </>
              )}
              {r.note && (
                <>
                  <dt className="text-muted-foreground">Ghi chú</dt>
                  <dd className="text-right whitespace-pre-line">{r.note}</dd>
                </>
              )}
            </dl>
            {confirmed && (
              <p
                className="mt-3 border-t pt-2 text-xs text-muted-foreground"
                title={
                  canReopen
                    ? 'Bấm "Sửa phiếu" ở đầu trang để mở lại phiếu về nháp (đảo tồn và công nợ). Chỉ làm được khi hàng chưa bán/chuyển và phiếu chưa thanh toán.'
                    : undefined
                }
              >
                {canReopen ? "Không mở lại được thì dùng phiếu điều chỉnh tồn kho." : "Đã xác nhận, không sửa được. Sai số lượng thì dùng điều chỉnh tồn kho."}
              </p>
            )}
          </Khoi>
        </div>
      </div>
    </div>
  );
}
