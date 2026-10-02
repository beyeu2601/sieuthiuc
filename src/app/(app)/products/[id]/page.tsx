import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getNumberSetting, getSetting } from "@/lib/settings";
import { driveConfigured } from "@/lib/google-drive";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { diffDays, formatDateVN, todayVN } from "@/lib/dates";
import { GOODS_TYPE_LABEL } from "@/lib/text";
import { PageHeader } from "@/components/page-header";
import { ChipHan, ChipSac, sacLoaiHang, sacTheoNhan, type MaHan, type SacNguNghia } from "@/components/ui/chip";
import { ChiSo, HangChiSo } from "@/components/ui/chi-so";
import { Khoi } from "@/components/khoi";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductForm } from "../product-form";
import { BarcodePanel } from "./barcode-panel";
import { LabelPreview } from "./label-preview";
import { ImageGallery } from "./image-gallery";
import { StockCostPanel } from "./stock-cost-panel";
import { DeleteProduct } from "./delete-product";

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
  const storeId = ctx.stores[0]?.id ?? null;

  const { data: p } = await supabase
    .from("products")
    .select(
      "id, sku, name, goods_type, unit, category_id, brand_id, pricing_method, sell_price, benefit_pct, cost_price_ref, date_type, expiry_level, expiry_date, min_stock, max_stock, status, note"
    )
    .eq("id", id)
    .maybeSingle();
  if (!p) notFound();

  const [
    { data: categories },
    { data: brands },
    { data: barcodes },
    { data: history },
    { data: lots },
    roundingUnit,
    labelSize,
    { data: images },
    { data: stock },
    defaultMin,
    shortDays,
    longDays,
  ] = await Promise.all([
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
    getNumberSetting("inventory.default_min_stock", 5, storeId),
    getNumberSetting("expiry.short_date_days", 15, storeId),
    getNumberSetting("expiry.long_date_days", 60, storeId),
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

  // Ton: cung quy tac voi inventory_status (kha dung <= 0 la het, <= toi thieu la sap het)
  const onHand = storeStock.reduce((s, x) => s + x.qty, 0);
  const reserved = storeStock.reduce((s, x) => s + x.reserved, 0);
  const available = onHand - reserved;
  const minStock = p.min_stock != null ? Number(p.min_stock) : defaultMin;
  const stockSac: SacNguNghia = available <= 0 ? "red" : available <= minStock ? "amber" : "emerald";
  const stockLabel = available <= 0 ? "Hết hàng" : available <= minStock ? "Sắp hết" : "Còn hàng";

  // Lai moi don vi tinh tren gia von tham chieu, % tinh tren gia von nhu % Benefit
  const cost = Number(p.cost_price_ref ?? 0);
  const sell = Number(p.sell_price ?? 0);
  const margin = sell - cost;
  const marginSac: SacNguNghia = cost <= 0 ? "slate" : margin <= 0 ? "red" : "emerald";

  // Han: nguong can date theo loai date cua san pham, giong man Han su dung
  const today = todayVN();
  const nearDays = p.date_type === "short" ? shortDays : longDays;
  const lotRows = (lots ?? []).map((l) => {
    const days = l.expiry_date ? diffDays(today, String(l.expiry_date).slice(0, 10)) : null;
    const ma: MaHan | null = days == null ? null : days < 0 ? "hetHan" : days <= nearDays ? "canDate" : "conHan";
    return { ...l, days, ma };
  });
  const nearest = lotRows.find((l) => l.days != null);
  const expirySac: SacNguNghia = !nearest ? "slate" : nearest.ma === "hetHan" ? "red" : nearest.ma === "canDate" ? "amber" : "emerald";
  const multiStore = ctx.stores.length > 1;

  const categoryName = (categories ?? []).find((c) => c.id === p.category_id)?.name;
  const brandName = (brands ?? []).find((b) => b.id === p.brand_id)?.name;

  return (
    <div className="space-y-4">
      <PageHeader
        back={back}
        title={p.name}
        description={
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <ChipSac sac="slate" className="font-mono">{p.sku}</ChipSac>
            <ChipSac sac={sacLoaiHang(p.goods_type)}>{GOODS_TYPE_LABEL[p.goods_type as "cont" | "air"]}</ChipSac>
            <ChipSac sac={p.status === "active" ? "emerald" : "red"}>{p.status === "active" ? "Đang bán" : "Ngừng bán"}</ChipSac>
            {categoryName ? <ChipSac sac={sacTheoNhan(categoryName)}>{categoryName}</ChipSac> : <ChipSac sac="amber">Chưa phân nhóm</ChipSac>}
            {brandName && <ChipSac sac="slate">{brandName}</ChipSac>}
            {bcList.length === 0 && <ChipSac sac="amber">Chưa có mã vạch</ChipSac>}
          </span>
        }
      />

      <HangChiSo>
        <ChiSo
          nhan="Giá bán"
          sac="brand"
          giaTri={formatMoney(sell)}
          phu={p.pricing_method === "benefit" ? `Theo % Benefit${p.benefit_pct != null ? ` ${p.benefit_pct}%` : ""}` : `Nhập trực tiếp, mỗi ${p.unit}`}
        />
        <ChiSo
          nhan={cost <= 0 ? "Chưa có giá vốn" : margin <= 0 ? "Lãi mỗi đơn vị: lỗ hoặc hòa" : "Lãi mỗi đơn vị"}
          sac={marginSac}
          giaTri={cost <= 0 ? "-" : formatMoney(margin)}
          phu={cost <= 0 ? "Nhập giá vốn ở khối Tồn kho" : `Giá vốn ${formatMoney(cost)} - ${Math.round((margin / cost) * 100)}% trên giá vốn`}
        />
        <ChiSo
          nhan={`Tồn kho: ${stockLabel}`}
          sac={stockSac}
          giaTri={`${formatNumber(available)} ${p.unit}`}
          phu={`${reserved > 0 ? `Giữ cho đơn ${formatNumber(reserved)} - ` : ""}Tối thiểu ${formatNumber(minStock)}`}
        />
        <ChiSo
          nhan={
            p.expiry_level === "none"
              ? "Hạn sử dụng"
              : !nearest
                ? "Hạn gần nhất"
                : nearest.ma === "hetHan"
                  ? "Có lô đã hết hạn"
                  : nearest.ma === "canDate"
                    ? "Lô sắp cận date"
                    : "Hạn gần nhất"
          }
          sac={expirySac}
          giaTri={nearest ? formatDateVN(String(nearest.expiry_date)) : "-"}
          phu={
            p.expiry_level === "none"
              ? "Không quản lý hạn sử dụng"
              : nearest
                ? `${nearest.days! < 0 ? `Quá ${-nearest.days!} ngày` : `Còn ${nearest.days} ngày`} - ${lotRows.length} lô còn hàng`
                : lotRows.length > 0
                  ? `${lotRows.length} lô còn hàng, chưa ghi hạn`
                  : "Chưa có lô nào còn hàng"
          }
        />
      </HangChiSo>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-4">
          <Khoi title="Thông tin sản phẩm">
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
          </Khoi>

          <section className="rounded-xl border bg-card p-4">
            <Tabs defaultValue="lots">
              <TabsList>
                <TabsTrigger value="lots" className="px-3">
                  Lô còn hàng ({lotRows.length})
                </TabsTrigger>
                <TabsTrigger value="history" className="px-3">
                  Lịch sử giá ({(history ?? []).length})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="lots" className="pt-2">
                {lotRows.length === 0 ? (
                  <p className="py-4 text-muted-foreground">Chưa có lô nào còn hàng.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {multiStore && <TableHead>Cửa hàng</TableHead>}
                          <TableHead>Lô</TableHead>
                          <TableHead>Hạn sử dụng</TableHead>
                          <TableHead className="text-right">Tồn</TableHead>
                          <TableHead className="text-right">Giá vốn lô</TableHead>
                          <TableHead>Nhập lúc</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lotRows.map((l) => (
                          <TableRow key={l.id}>
                            {multiStore && <TableCell>{(l.stores as unknown as { code: string } | null)?.code}</TableCell>}
                            <TableCell className="font-mono text-xs">{l.lot_no}</TableCell>
                            <TableCell>
                              {l.ma ? (
                                <ChipHan ma={l.ma}>
                                  {formatDateVN(String(l.expiry_date))} -{" "}
                                  {l.days! < 0 ? `quá ${-l.days!} ngày` : `còn ${l.days} ngày`}
                                </ChipHan>
                              ) : (
                                <span className="text-muted-foreground">Không có</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-medium tabular-nums">{formatNumber(l.qty_on_hand)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatMoney(l.unit_cost)}</TableCell>
                            <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(l.received_at)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="history" className="pt-2">
                {(history ?? []).length === 0 ? (
                  <p className="py-4 text-muted-foreground">Chưa có thay đổi giá.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Thời gian</TableHead>
                          <TableHead>Nội dung</TableHead>
                          <TableHead>Thay đổi</TableHead>
                          <TableHead>Người đổi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(history ?? []).map((h) => {
                          const oldN = Number(h.old_value);
                          const newN = Number(h.new_value);
                          const delta =
                            h.field === "sell_price" && h.old_value != null && h.new_value != null && oldN > 0 ? Math.round(((newN - oldN) / oldN) * 100) : null;
                          return (
                            <TableRow key={h.id}>
                              <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(h.changed_at)}</TableCell>
                              <TableCell>{FIELD_LABEL[h.field] ?? h.field}</TableCell>
                              <TableCell className="whitespace-nowrap tabular-nums">
                                <span className="text-muted-foreground line-through">{showValue(h.field, h.old_value)}</span>
                                {" -> "}
                                <span className="font-medium">{showValue(h.field, h.new_value)}</span>
                                {delta != null && delta !== 0 && (
                                  <ChipSac sac={delta > 0 ? "emerald" : "rose"} className="ml-2">
                                    {delta > 0 ? "+" : ""}
                                    {delta}%
                                  </ChipSac>
                                )}
                              </TableCell>
                              <TableCell>{(h.profiles as unknown as { full_name: string } | null)?.full_name ?? "Hệ thống"}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </section>
        </div>

        <div className="min-w-0 space-y-4">
          {canEdit && storeStock.length > 0 && (
            <Khoi title="Tồn kho và giá vốn">
              <StockCostPanel productId={p.id} stores={storeStock} lotExpiry={p.expiry_level === "lot"} />
            </Khoi>
          )}

          <Khoi title="Mã vạch và tem">
            <div className="space-y-4">
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
              <BarcodePanel productId={p.id} barcodes={barcodes ?? []} canEdit={canEdit} />
            </div>
          </Khoi>

          <Khoi title="Ảnh sản phẩm" aside={<span className="text-xs text-muted-foreground tabular-nums">{(images ?? []).length}/10</span>}>
            <ImageGallery productId={p.id} productName={p.name} images={images ?? []} canEdit={canEdit} configured={driveConfigured()} />
          </Khoi>

          {canEdit && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-destructive/40 px-4 py-3">
              <p className="text-xs text-muted-foreground">Chỉ xóa được khi chưa có giao dịch và đã hết tồn. Còn lại dùng Ngừng bán.</p>
              <DeleteProduct productId={p.id} productName={p.name} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
