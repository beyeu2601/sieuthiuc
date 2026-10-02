import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getNumberSetting, getSetting } from "@/lib/settings";
import { driveConfigured } from "@/lib/google-drive";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { GOODS_TYPE_LABEL } from "@/lib/text";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProductForm } from "../product-form";
import { BarcodePanel } from "./barcode-panel";
import { LabelPreview } from "./label-preview";
import { ImageGallery } from "./image-gallery";
import { StockCostPanel } from "./stock-cost-panel";

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

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  // Chi nhan duong dan noi bo cua man Ton kho, con lai quay ve danh sach san pham
  const back =
    from && /^\/[A-Za-z0-9_-]+\/inventory(\/|\?|$)/.test(from)
      ? { href: from, label: "Tồn kho" }
      : { href: "/products", label: "Sản phẩm" };
  const ctx = await requireRole("sadmin", "admin", "accountant");
  const canEdit = ctx.profile.role !== "accountant";
  const supabase = await createClient();

  const { data: p } = await supabase
    .from("products")
    .select(
      "id, sku, name, goods_type, unit, category_id, brand_id, pricing_method, sell_price, benefit_pct, cost_price_ref, date_type, expiry_level, expiry_date, min_stock, max_stock, status, note"
    )
    .eq("id", id)
    .maybeSingle();
  if (!p) notFound();

  const [{ data: categories }, { data: brands }, { data: barcodes }, { data: history }, { data: lots }, roundingUnit, labelSize, { data: images }, { data: stock }] =
    await Promise.all([
      supabase.from("categories").select("id, name, benefit_pct, description").order("name"),
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
      getSetting<string>("label.size", "40x30"),
      supabase
        .from("product_images")
        .select("id, drive_file_id, drive_thumb_id, is_thumbnail")
        .eq("product_id", id)
        .order("sort_order"),
      supabase.from("inventory").select("store_id, qty_on_hand, qty_reserved, avg_cost").eq("product_id", id),
    ]);

  const bcList = (barcodes ?? []) as { barcode: string; is_primary: boolean }[];
  const primaryBarcode = bcList.find((b) => b.is_primary)?.barcode ?? bcList[0]?.barcode ?? p.sku;
  const [labelW, labelH] = String(labelSize).split("x").map(Number);
  const storeStock = ctx.stores.map((st) => {
    const row = (stock ?? []).find((r) => r.store_id === st.id);
    return {
      storeId: st.id,
      storeCode: st.code,
      qty: Number(row?.qty_on_hand ?? 0),
      reserved: Number(row?.qty_reserved ?? 0),
      avgCost: Number(row?.avg_cost ?? 0),
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        back={back}
        title={p.name}
        description={`${p.sku} - ${GOODS_TYPE_LABEL[p.goods_type as "cont" | "air"]} - Giá vốn tham chiếu ${formatMoney(p.cost_price_ref)}`}
      />

      <section className="rounded-xl border bg-card p-4" aria-labelledby="info">
        <h2 id="info" className="mb-1 font-medium">
          Thông tin
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">Tên, loại hàng, đơn vị, nhóm, cách đặt giá và giá bán của sản phẩm.</p>
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
            date_type: p.date_type,
            expiry_level: p.expiry_level,
            expiry_date: p.expiry_date,
            min_stock: p.min_stock,
            max_stock: p.max_stock,
            status: p.status,
            note: p.note,
          }}
        />
      </section>

      {canEdit && storeStock.length > 0 && (
        <section className="rounded-xl border bg-card p-4" aria-labelledby="stock">
          <h2 id="stock" className="mb-1 font-medium">
            Tồn kho và giá vốn
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Chỉnh thẳng số tồn khi hàng về, không cần tạo phiếu nhập. Mỗi lần chỉnh được ghi vào lịch sử biến động kho.
          </p>
          <StockCostPanel productId={p.id} stores={storeStock} lotExpiry={p.expiry_level === "lot"} />
        </section>
      )}

      <section className="rounded-xl border bg-card p-4" aria-labelledby="images">
        <h2 id="images" className="mb-1 font-medium">
          Ảnh sản phẩm
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">Tối đa 10 ảnh. Ảnh đầu tiên là ảnh đại diện hiện ở danh sách sản phẩm.</p>
        <ImageGallery productId={p.id} productName={p.name} images={images ?? []} canEdit={canEdit} configured={driveConfigured()} />
      </section>

      <section className="rounded-xl border bg-card p-4" aria-labelledby="barcodes">
        <h2 id="barcodes" className="mb-3 font-medium">
          Mã vạch
        </h2>
        <BarcodePanel productId={p.id} barcodes={barcodes ?? []} canEdit={canEdit} />
      </section>

      <section className="rounded-xl border bg-card p-4" aria-labelledby="label">
        <h2 id="label" className="mb-3 font-medium">
          Tem nhãn
        </h2>
        <LabelPreview
          productId={p.id}
          name={p.name}
          price={p.sell_price}
          barcode={primaryBarcode}
          sku={p.sku}
          hasBarcode={bcList.length > 0}
          widthMm={labelW || 40}
          heightMm={labelH || 30}
        />
      </section>

      <section className="rounded-xl border bg-card p-4" aria-labelledby="lots">
        <h2 id="lots" className="mb-1 font-medium">
          Lô đang còn hàng
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">Các lô còn tồn theo hạn sử dụng và giá vốn từng lô. Bán hàng trừ lô gần hết hạn trước (FEFO).</p>
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

      <section className="rounded-xl border bg-card p-4" aria-labelledby="history">
        <h2 id="history" className="mb-1 font-medium">
          Lịch sử giá
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">Ghi lại mỗi lần đổi giá bán, % Benefit hoặc cách đặt giá - kèm người đổi và thời gian.</p>
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
