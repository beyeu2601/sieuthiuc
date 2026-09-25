import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getNumberSetting } from "@/lib/settings";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { GOODS_TYPE_LABEL } from "@/lib/text";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProductForm } from "../product-form";
import { BarcodePanel } from "./barcode-panel";

const FIELD_LABEL: Record<string, string> = {
  sell_price: "Giá bán",
  benefit_pct: "% Benefit",
  pricing_method: "Cách đặt giá",
};
const METHOD_LABEL: Record<string, string> = { manual: "Nhập trực tiếp", benefit: "Theo % Benefit" };

function showValue(field: string, v: string | null) {
  if (v == null) return "-";
  if (field === "sell_price") return formatMoney(Number(v));
  if (field === "benefit_pct") return `${v}%`;
  if (field === "pricing_method") return METHOD_LABEL[v] ?? v;
  return v;
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireRole("sadmin", "admin", "accountant");
  const canEdit = ctx.profile.role !== "accountant";
  const supabase = await createClient();

  const { data: p } = await supabase
    .from("products")
    .select(
      "id, sku, name, goods_type, unit, category_id, brand_id, pricing_method, sell_price, benefit_pct, cost_price_ref, expiry_level, expiry_date, min_stock, max_stock, status, note"
    )
    .eq("id", id)
    .maybeSingle();
  if (!p) notFound();

  const [{ data: categories }, { data: brands }, { data: barcodes }, { data: history }, { data: lots }, roundingUnit] =
    await Promise.all([
      supabase.from("categories").select("id, name, benefit_pct").order("name"),
      supabase.from("brands").select("id, name").order("name"),
      supabase
        .from("product_barcodes")
        .select("id, barcode, type, pack_qty, is_primary")
        .eq("product_id", id)
        .order("is_primary", { ascending: false }),
      supabase
        .from("price_history")
        .select("id, field, old_value, new_value, changed_at, profiles:changed_by(full_name)")
        .eq("product_id", id)
        .order("changed_at", { ascending: false })
        .limit(50),
      supabase
        .from("stock_lots")
        .select("id, lot_no, expiry_date, qty_on_hand, unit_cost, received_at, stores(code)")
        .eq("product_id", id)
        .gt("qty_on_hand", 0)
        .order("expiry_date", { ascending: true, nullsFirst: false }),
      getNumberSetting("pricing.rounding_unit", 1000),
    ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={p.name}
        description={`${p.sku} - ${GOODS_TYPE_LABEL[p.goods_type as "cont" | "air"]} - Giá vốn tham chiếu ${formatMoney(p.cost_price_ref)}`}
        actions={
          <Button variant="outline" render={<Link href={`/print/labels?ids=${p.id}`} target="_blank" />}>
            In tem
          </Button>
        }
      />

      <section className="rounded-xl border bg-background p-4" aria-labelledby="info">
        <h2 id="info" className="mb-3 font-medium">
          Thông tin
        </h2>
        <ProductForm
          id={p.id}
          readOnly={!canEdit}
          costPriceRef={p.cost_price_ref}
          roundingUnit={roundingUnit}
          categories={categories ?? []}
          brands={brands ?? []}
          initial={{
            name: p.name,
            goods_type: p.goods_type,
            unit: p.unit,
            category_id: p.category_id,
            brand_id: p.brand_id,
            pricing_method: p.pricing_method,
            sell_price: p.sell_price,
            benefit_pct: p.benefit_pct,
            expiry_level: p.expiry_level,
            expiry_date: p.expiry_date,
            min_stock: p.min_stock,
            max_stock: p.max_stock,
            status: p.status,
            note: p.note,
          }}
        />
      </section>

      <section className="rounded-xl border bg-background p-4" aria-labelledby="barcodes">
        <h2 id="barcodes" className="mb-3 font-medium">
          Mã vạch
        </h2>
        <BarcodePanel productId={p.id} barcodes={barcodes ?? []} canEdit={canEdit} />
      </section>

      <section className="rounded-xl border bg-background p-4" aria-labelledby="lots">
        <h2 id="lots" className="mb-3 font-medium">
          Lô đang còn hàng
        </h2>
        {(lots ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có lô nào còn hàng.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cửa hàng</TableHead>
                  <TableHead>Lô</TableHead>
                  <TableHead>Hạn sử dụng</TableHead>
                  <TableHead className="text-right">Tồn</TableHead>
                  <TableHead className="text-right">Giá vốn lô</TableHead>
                  <TableHead>Nhập lúc</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(lots ?? []).map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{(l.stores as unknown as { code: string } | null)?.code}</TableCell>
                    <TableCell>{l.lot_no}</TableCell>
                    <TableCell>{l.expiry_date ? new Date(l.expiry_date).toLocaleDateString("vi-VN") : "Không có"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(l.qty_on_hand)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(l.unit_cost)}</TableCell>
                    <TableCell>{formatDateTime(l.received_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-background p-4" aria-labelledby="history">
        <h2 id="history" className="mb-3 font-medium">
          Lịch sử giá
        </h2>
        {(history ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có thay đổi giá.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Nội dung</TableHead>
                  <TableHead>Cũ</TableHead>
                  <TableHead>Mới</TableHead>
                  <TableHead>Người đổi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(history ?? []).map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="whitespace-nowrap">{formatDateTime(h.changed_at)}</TableCell>
                    <TableCell>{FIELD_LABEL[h.field] ?? h.field}</TableCell>
                    <TableCell className="tabular-nums">{showValue(h.field, h.old_value)}</TableCell>
                    <TableCell className="tabular-nums">{showValue(h.field, h.new_value)}</TableCell>
                    <TableCell>{(h.profiles as unknown as { full_name: string } | null)?.full_name ?? "Hệ thống"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
