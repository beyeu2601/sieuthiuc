import Link from "next/link";
import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, formatNumber } from "@/lib/format";
import { GOODS_TYPE_LABEL } from "@/lib/text";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { MobileCard, MobileCardList } from "@/components/mobile-card";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { FilterBar } from "@/components/filter-bar";
import { FilterChip } from "@/components/filter-chip";
import { Pagination } from "@/components/pagination";
import { ChipSac } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InventoryTabs } from "./inventory-tabs";
import { STOCK_STATUS } from "./labels";

export const metadata = { title: "Tồn kho" };
const PAGE_SIZE = 50;

type Row = {
  product_id: string;
  sku: string;
  name: string;
  unit: string;
  goods_type: "cont" | "air";
  category: string | null;
  barcode: string | null;
  qty_on_hand: number;
  qty_reserved: number;
  qty_available: number;
  min_stock: number;
  stock_status: "out" | "low" | "in_stock";
  suggest_qty: number;
  avg_cost: number | null;
  stock_value: number | null;
  nearest_expiry: string | null;
  total_count: number;
};

type SP = { q?: string; status?: string | string[]; type?: string | string[]; cat?: string | string[]; page?: string; f?: string };

const toArr = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

export default async function InventoryPage({ params, searchParams }: { params: Promise<{ store: string }>; searchParams: Promise<SP> }) {
  const { store: code } = await params;
  const sp = await searchParams;
  const { ctx, store } = await requireStore(code);
  const isStaff = ctx.profile.role === "staff";
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();

  // Vao trang lan dau (chua gui form, khong co f) mac dinh loc "Con hang"; form luon gui f=1 nen bo tick het van la khong loc.
  const statusSel: string[] = sp.f ? toArr(sp.status).filter((s) => s === "out" || s === "low" || s === "in_stock") : ["in_stock"];
  const typeSel = toArr(sp.type).filter((t) => t === "cont" || t === "air");
  const catSel = toArr(sp.cat);

  const [{ data: cats }, { data, error }] = await Promise.all([
    supabase.from("categories").select("id, name").order("name"),
    supabase.rpc("inventory_status", {
      p_store_id: store.id,
      p_q: sp.q || null,
      p_status: statusSel.length ? statusSel : null,
      p_category: catSel.length ? catSel : null,
      p_goods_type: typeSel.length ? typeSel : null,
      p_limit: PAGE_SIZE,
      p_offset: (page - 1) * PAGE_SIZE,
    }),
  ]);
  const rows = (data ?? []) as Row[];
  const total = rows[0]?.total_count ?? 0;
  // Giu bo loc hien tai de trang chi tiet san pham quay lai dung danh sach
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) for (const x of toArr(v)) qs.append(k, x);
  const from = encodeURIComponent(`/${store.code}/inventory${qs.size ? `?${qs}` : ""}`);

  return (
    <div>
      <PageHeader
        title="Tồn kho"
        description={`${store.name}. Khả dụng = tồn thực tế - đang giữ cho đơn online.`}
        actions={
          !isStaff && (
            <Button variant="outline" render={<Link href={`/${store.code}/inventory/low`} />}>
              Cần nhập thêm
            </Button>
          )
        }
      />
      <InventoryTabs storeCode={store.code} />
      <AutoSubmitForm action={`/${store.code}/inventory`} debounceMs={400} className="my-3 space-y-2.5" role="search">
        <input type="hidden" name="f" value="1" />
        <FilterBar
          search={<Input type="search" enterKeyHint="search" name="q" defaultValue={sp.q} placeholder="Tìm tên, SKU hoặc quét mã" aria-label="Tìm sản phẩm" />}
        >
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <div role="group" aria-label="Trạng thái tồn" className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-medium text-muted-foreground">Trạng thái</span>
              <FilterChip name="status" value="in_stock" label="Còn hàng" checked={statusSel.includes("in_stock")} />
              <FilterChip name="status" value="low" label="Sắp hết" checked={statusSel.includes("low")} />
              <FilterChip name="status" value="out" label="Hết hàng" checked={statusSel.includes("out")} />
            </div>
            <div role="group" aria-label="Loại hàng" className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-medium text-muted-foreground">Loại</span>
              <FilterChip name="type" value="cont" label="Cont" checked={typeSel.includes("cont")} />
              <FilterChip name="type" value="air" label="Air" checked={typeSel.includes("air")} />
            </div>
            <div role="group" aria-label="Nhóm hàng" className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-medium text-muted-foreground">Nhóm hàng</span>
              {(cats ?? []).map((c) => (
                <FilterChip key={c.id} name="cat" value={c.id} label={c.name} checked={catSel.includes(c.id)} />
              ))}
            </div>
          </div>
        </FilterBar>
      </AutoSubmitForm>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          Không tải được tồn kho.
        </p>
      ) : rows.length === 0 ? (
        <EmptyState title="Không có sản phẩm phù hợp" />
      ) : (
        <>
        <MobileCardList label="Danh sách tồn kho">
          {rows.map((r) => {
            const st = STOCK_STATUS[r.stock_status];
            return (
              <MobileCard
                key={r.product_id}
                title={isStaff ? r.name : <Link href={`/products/${r.product_id}?from=${from}`} className="hover:underline">{r.name}</Link>}
                subtitle={`${r.sku}${r.barcode ? ` - ${r.barcode}` : ""}${isStaff ? "" : ` - ${GOODS_TYPE_LABEL[r.goods_type]}`}`}
                badge={<ChipSac sac={st.sac}>{st.label}</ChipSac>}
                stats={[
                  { label: `Khả dụng (${r.unit})`, value: formatNumber(r.qty_available), strong: true },
                  ...(!isStaff
                    ? [
                        { label: "Tồn thực tế", value: formatNumber(r.qty_on_hand) },
                        { label: "Đang giữ", value: formatNumber(r.qty_reserved) },
                        { label: "Giá vốn BQ", value: formatMoney(r.avg_cost) },
                        { label: "Giá trị tồn", value: formatMoney(r.stock_value) },
                      ]
                    : []),
                  { label: "HSD gần nhất", value: r.nearest_expiry ? new Date(r.nearest_expiry).toLocaleDateString("vi-VN") : "-" },
                ]}
              />
            );
          })}
        </MobileCardList>
        <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-56">Sản phẩm</TableHead>
                {!isStaff && <TableHead>Loại</TableHead>}
                <TableHead>ĐVT</TableHead>
                {!isStaff && <TableHead className="text-right">Tồn thực tế</TableHead>}
                {!isStaff && <TableHead className="text-right">Đang giữ</TableHead>}
                <TableHead className="text-right">Khả dụng</TableHead>
                <TableHead>HSD gần nhất</TableHead>
                {!isStaff && <TableHead className="text-right">Giá vốn BQ</TableHead>}
                {!isStaff && <TableHead className="text-right">Giá trị tồn</TableHead>}
                <TableHead>Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const st = STOCK_STATUS[r.stock_status];
                return (
                  <TableRow key={r.product_id}>
                    <TableCell className="min-w-56 whitespace-normal">
                      {isStaff ? r.name : <Link href={`/products/${r.product_id}?from=${from}`} className="hover:underline">{r.name}</Link>}
                      <div className="text-xs text-muted-foreground">
                        {r.sku}
                        {r.barcode ? ` - ${r.barcode}` : ""}
                      </div>
                    </TableCell>
                    {!isStaff && <TableCell>{GOODS_TYPE_LABEL[r.goods_type]}</TableCell>}
                    <TableCell>{r.unit}</TableCell>
                    {!isStaff && <TableCell className="text-right tabular-nums">{formatNumber(r.qty_on_hand)}</TableCell>}
                    {!isStaff && <TableCell className="text-right tabular-nums">{formatNumber(r.qty_reserved)}</TableCell>}
                    <TableCell className="text-right font-medium tabular-nums">{formatNumber(r.qty_available)}</TableCell>
                    <TableCell>{r.nearest_expiry ? new Date(r.nearest_expiry).toLocaleDateString("vi-VN") : "-"}</TableCell>
                    {!isStaff && <TableCell className="text-right tabular-nums">{formatMoney(r.avg_cost)}</TableCell>}
                    {!isStaff && <TableCell className="text-right tabular-nums">{formatMoney(r.stock_value)}</TableCell>}
                    <TableCell>
                      <ChipSac sac={st.sac}>{st.label}</ChipSac>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        </>
      )}
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={Number(total)}
        basePath={`/${store.code}/inventory`}
        params={{ f: "1", q: sp.q, status: statusSel, type: typeSel, cat: catSel }}
      />
    </div>
  );
}
