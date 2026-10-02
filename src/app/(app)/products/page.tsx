import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, formatNumber } from "@/lib/format";
import { GOODS_TYPE_LABEL, ilikeTerm } from "@/lib/text";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { ProductThumb } from "@/components/product-thumb";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { FilterBar } from "@/components/filter-bar";
import { CameraScanButton } from "@/components/camera-scan-button";
import { Pagination } from "@/components/pagination";
import { EmptyState } from "@/components/empty-state";
import { FilterChip } from "@/components/filter-chip";
import { CategoryInfo } from "@/components/category-info";
import { ChipSac, sacLoaiHang } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BulkBar, BulkSelectProvider, SelectAllBox, SelectBox } from "./bulk-select";
import { CategoryCell } from "./category-cell";

export const metadata = { title: "Sản phẩm" };

const PAGE_SIZE = 50;

type Row = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  goods_type: "cont" | "air";
  sell_price: number;
  cost_price_ref: number;
  pricing_method: "manual" | "benefit";
  benefit_pct: number | null;
  status: "active" | "inactive";
  category_id: string | null;
  categories: { name: string; benefit_pct: number | null } | null;
  product_barcodes: { barcode: string; is_primary: boolean }[];
  inventory: { qty_on_hand: number }[];
  product_images: { drive_thumb_id: string }[];
};

type SP = { q?: string; type?: string | string[]; status?: string | string[]; cat?: string | string[]; missing?: string | string[]; page?: string; f?: string };

const toArr = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

// du lieu con thieu sau import ton dau ky: DVT "Chua ro", gia von hoac gia ban bang 0
const MISSING_COND: Record<string, string> = {
  unit: 'unit.eq."Chưa rõ"',
  cost: "cost_price_ref.eq.0",
  price: "sell_price.eq.0",
};

const stockOf = (p: Row) => p.inventory.reduce((s, i) => s + Number(i.qty_on_hand), 0);

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireRole("sadmin", "admin", "accountant");
  const canEdit = ctx.profile.role !== "accountant";
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  // Vao trang lan dau (chua gui form, khong co f) mac dinh loc "Dang ban"; form luon gui f=1 nen bo tick het van la khong loc.
  const statusSel = sp.f ? toArr(sp.status).filter((s) => s === "active" || s === "inactive") : ["active"];
  const typeSel = toArr(sp.type).filter((t) => t === "cont" || t === "air");
  const catSel = toArr(sp.cat);
  const missingSel = toArr(sp.missing).filter((m) => m in MISSING_COND);
  const supabase = await createClient();

  const [{ data: categories }, { data: brands }] = await Promise.all([
    supabase.from("categories").select("id, name, description").order("name"),
    canEdit ? supabase.from("brands").select("id, name").order("name") : Promise.resolve({ data: null }),
  ]);

  let query = supabase
    .from("products")
    .select(
      "id, sku, name, unit, goods_type, sell_price, cost_price_ref, pricing_method, benefit_pct, status, category_id, categories(name, benefit_pct), product_barcodes(barcode, is_primary), inventory(qty_on_hand), product_images(drive_thumb_id)",
      { count: "exact" }
    )
    .eq("product_images.is_thumbnail", true)
    .order("created_at", { ascending: false })
    .order("sku", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const q = sp.q?.trim();
  if (q) {
    // quet ma vach: tim dung ma truoc
    const { data: hit } = await supabase.from("product_barcodes").select("product_id").eq("barcode", q.toUpperCase());
    if (hit && hit.length > 0) query = query.in("id", hit.map((h) => h.product_id));
    else query = query.ilike("search_key", ilikeTerm(q));
  }
  if (typeSel.length) query = query.in("goods_type", typeSel);
  if (statusSel.length) query = query.in("status", statusSel);
  if (catSel.length) query = query.in("category_id", catSel);
  if (missingSel.length) query = query.or(missingSel.map((m) => MISSING_COND[m]).join(","));

  const { data, count, error } = await query.returns<Row[]>();
  const rows = data ?? [];

  return (
    <div>
      <PageHeader
        title="Sản phẩm"
        actions={
          canEdit && (
            <>
              <Button variant="outline" className="hidden md:inline-flex" render={<Link href="/products/price-suggestions" />}>
                Gợi ý giá
              </Button>
              <Button variant="outline" className="hidden md:inline-flex" render={<Link href="/products/import" />}>
                Import Excel
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="outline" className="md:hidden" />}>Khác</DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-44">
                  <DropdownMenuItem className="h-10" render={<Link href="/products/price-suggestions" />}>
                    Gợi ý giá
                  </DropdownMenuItem>
                  <DropdownMenuItem className="h-10" render={<Link href="/products/import" />}>
                    Import Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button render={<Link href="/products/new" />}>Thêm sản phẩm</Button>
            </>
          )
        }
      />

      <AutoSubmitForm action="/products" debounceMs={400} className="mb-3" role="search">
        <input type="hidden" name="f" value="1" />
        <FilterBar
          search={
            <div className="flex gap-2">
              <Input
                type="search"
                enterKeyHint="search"
                name="q"
                defaultValue={sp.q}
                placeholder="Tìm tên, SKU hoặc mã vạch"
                aria-label="Tìm sản phẩm"
              />
              <span className="md:hidden">
                <CameraScanButton />
              </span>
            </div>
          }
        >
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <div role="group" aria-label="Trạng thái" className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-medium text-muted-foreground">Trạng thái</span>
              <FilterChip name="status" value="active" label="Đang bán" checked={statusSel.includes("active")} />
              <FilterChip name="status" value="inactive" label="Ngừng bán" checked={statusSel.includes("inactive")} />
            </div>
            <div role="group" aria-label="Loại hàng" className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-medium text-muted-foreground">Loại</span>
              <FilterChip name="type" value="cont" label="Cont" checked={typeSel.includes("cont")} />
              <FilterChip name="type" value="air" label="Air" checked={typeSel.includes("air")} />
            </div>
            <div role="group" aria-label="Thiếu thông tin" className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-medium text-muted-foreground">Thiếu</span>
              <FilterChip name="missing" value="unit" label="ĐVT" checked={missingSel.includes("unit")} />
              <FilterChip name="missing" value="cost" label="Giá vốn" checked={missingSel.includes("cost")} />
              <FilterChip name="missing" value="price" label="Giá bán" checked={missingSel.includes("price")} />
            </div>
            <div role="group" aria-label="Nhóm hàng" className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                Nhóm hàng
                <CategoryInfo categories={categories ?? []} />
              </span>
              {(categories ?? []).map((c) => (
                <FilterChip key={c.id} name="cat" value={c.id} label={c.name} checked={catSel.includes(c.id)} />
              ))}
            </div>
          </div>
        </FilterBar>
      </AutoSubmitForm>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          Không tải được danh sách sản phẩm.
        </p>
      ) : rows.length === 0 ? (
        <EmptyState title="Không có sản phẩm phù hợp">Thử bỏ bớt bộ lọc hoặc tìm bằng từ khác.</EmptyState>
      ) : (
        <BulkSelectProvider key={JSON.stringify(sp)}>
        <p className="mb-2 text-sm text-muted-foreground">{formatNumber(count ?? rows.length)} sản phẩm</p>
        <ul className="space-y-2 md:hidden" aria-label="Danh sách sản phẩm">
          {rows.map((p) => {
            const stock = stockOf(p);
            return (
              <li key={p.id} className="flex items-start gap-1">
                {canEdit && <SelectBox id={p.id} label={p.name} />}
                <Link href={`/products/${p.id}`} className="flex min-w-0 flex-1 items-start gap-3 rounded-xl border bg-card p-3.5 active:bg-muted">
                  <ProductThumb fileId={p.product_images[0]?.drive_thumb_id} size={56} />
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 font-medium">{p.name}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {GOODS_TYPE_LABEL[p.goods_type]} - {p.unit} - {p.sku}
                    </div>
                    {p.status === "inactive" && (
                      <ChipSac sac="slate" className="mt-1">
                        Ngừng bán
                      </ChipSac>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-semibold tabular-nums">{formatMoney(p.sell_price)}</div>
                    <div className={cn("text-sm tabular-nums", stock <= 0 ? "font-medium text-destructive" : "text-muted-foreground")}>
                      Tồn {formatNumber(stock)}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
          <Table>
            <TableHeader>
              <TableRow>
                {canEdit && (
                  <TableHead className="w-12">
                    <SelectAllBox ids={rows.map((r) => r.id)} />
                  </TableHead>
                )}
                <TableHead className="w-14">
                  <span className="sr-only">Ảnh</span>
                </TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Mã vạch</TableHead>
                <TableHead className="min-w-64">Tên</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead>ĐVT</TableHead>
                <TableHead className="text-right">Giá bán</TableHead>
                <TableHead className="text-right">Giá vốn TC</TableHead>
                <TableHead className="text-right">% Benefit</TableHead>
                <TableHead className="text-right" title="Tổng tồn các cửa hàng bạn được xem">
                  Tồn
                </TableHead>
                <TableHead>Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => {
                const primary = p.product_barcodes.find((b) => b.is_primary) ?? p.product_barcodes[0];
                const stock = stockOf(p);
                const pct = p.benefit_pct ?? p.categories?.benefit_pct ?? null;
                return (
                  <TableRow key={p.id}>
                    {canEdit && (
                      <TableCell className="py-0">
                        <SelectBox id={p.id} label={p.name} />
                      </TableCell>
                    )}
                    <TableCell className="py-1.5">
                      <ProductThumb fileId={p.product_images[0]?.drive_thumb_id} size={44} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Link href={`/products/${p.id}`} className="font-medium underline-offset-4 hover:underline">
                        {p.sku}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular-nums">{primary?.barcode ?? "-"}</TableCell>
                    <TableCell className="min-w-64 whitespace-normal">
                      <Link href={`/products/${p.id}`} className="hover:underline">
                        {p.name}
                      </Link>
                      {canEdit ? (
                        <div>
                          <CategoryCell productId={p.id} productName={p.name} categoryId={p.category_id} categories={categories ?? []} />
                        </div>
                      ) : (
                        p.categories && <div className="text-xs text-muted-foreground">{p.categories.name}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <ChipSac sac={sacLoaiHang(p.goods_type)}>{GOODS_TYPE_LABEL[p.goods_type]}</ChipSac>
                    </TableCell>
                    <TableCell>{p.unit}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(p.sell_price)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(p.cost_price_ref)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.pricing_method === "benefit" && pct != null ? `${pct}%` : "-"}
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums", stock <= 0 && "font-medium text-destructive")}>{formatNumber(stock)}</TableCell>
                    <TableCell>
                      <ChipSac sac={p.status === "active" ? "emerald" : "slate"}>
                        {p.status === "active" ? "Đang bán" : "Ngừng bán"}
                      </ChipSac>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {canEdit && <BulkBar categories={categories ?? []} brands={brands ?? []} />}
        </BulkSelectProvider>
      )}
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={count ?? 0}
        basePath="/products"
        params={{ q: sp.q, type: sp.type, status: sp.status, cat: sp.cat, missing: sp.missing, f: sp.f }}
      />
    </div>
  );
}
