import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, formatNumber } from "@/lib/format";
import { GOODS_TYPE_LABEL, ilikeTerm } from "@/lib/text";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { CameraScanButton } from "@/components/camera-scan-button";
import { Pagination } from "@/components/pagination";
import { EmptyState } from "@/components/empty-state";
import { NativeSelect } from "@/components/native-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
  categories: { name: string; benefit_pct: number | null } | null;
  product_barcodes: { barcode: string; is_primary: boolean }[];
  inventory: { qty_on_hand: number }[];
};

type SP = { q?: string; type?: string; status?: string; cat?: string; missing?: string; page?: string };

const stockOf = (p: Row) => p.inventory.reduce((s, i) => s + Number(i.qty_on_hand), 0);

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireRole("sadmin", "admin", "accountant");
  const canEdit = ctx.profile.role !== "accountant";
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const status = sp.status ?? "active";
  const supabase = await createClient();

  const { data: categories } = await supabase.from("categories").select("id, name").order("name");

  let query = supabase
    .from("products")
    .select(
      "id, sku, name, unit, goods_type, sell_price, cost_price_ref, pricing_method, benefit_pct, status, categories(name, benefit_pct), product_barcodes(barcode, is_primary), inventory(qty_on_hand)",
      { count: "exact" }
    )
    .order("name")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const q = sp.q?.trim();
  if (q) {
    // quet ma vach: tim dung ma truoc
    const { data: hit } = await supabase.from("product_barcodes").select("product_id").eq("barcode", q.toUpperCase());
    if (hit && hit.length > 0) query = query.in("id", hit.map((h) => h.product_id));
    else query = query.ilike("search_key", ilikeTerm(q));
  }
  if (sp.type === "cont" || sp.type === "air") query = query.eq("goods_type", sp.type);
  if (status === "active" || status === "inactive") query = query.eq("status", status);
  if (sp.cat) query = query.eq("category_id", sp.cat);
  // du lieu con thieu sau import ton dau ky: DVT "Chua ro", gia von hoac gia ban bang 0
  if (sp.missing === "unit") query = query.eq("unit", "Chưa rõ");
  else if (sp.missing === "cost") query = query.eq("cost_price_ref", 0);
  else if (sp.missing === "price") query = query.eq("sell_price", 0);
  else if (sp.missing === "any") query = query.or('unit.eq."Chưa rõ",cost_price_ref.eq.0,sell_price.eq.0');

  const { data, count, error } = await query.returns<Row[]>();
  const rows = data ?? [];

  return (
    <div>
      <PageHeader
        title="Sản phẩm"
        description={<span className="hidden md:inline">Danh mục dùng chung cho mọi cửa hàng. Tồn là tổng các cửa hàng bạn được xem.</span>}
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

      <AutoSubmitForm action="/products" className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-[1fr_120px_130px_170px_160px_auto]" role="search">
        <div className="col-span-2 flex gap-2 lg:col-span-1">
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
        <NativeSelect name="type" defaultValue={sp.type ?? ""} aria-label="Loại hàng">
          <option value="">Mọi loại hàng</option>
          <option value="cont">Cont</option>
          <option value="air">Air</option>
        </NativeSelect>
        <NativeSelect name="status" defaultValue={status} aria-label="Trạng thái">
          <option value="active">Đang bán</option>
          <option value="inactive">Ngừng bán</option>
          <option value="all">Tất cả</option>
        </NativeSelect>
        <NativeSelect name="cat" defaultValue={sp.cat ?? ""} aria-label="Nhóm hàng">
          <option value="">Mọi nhóm hàng</option>
          {(categories ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="missing" defaultValue={sp.missing ?? ""} aria-label="Thiếu thông tin">
          <option value="">Mọi dữ liệu</option>
          <option value="any">Thiếu thông tin</option>
          <option value="unit">Chưa rõ ĐVT</option>
          <option value="cost">Thiếu giá vốn</option>
          <option value="price">Thiếu giá bán</option>
        </NativeSelect>
        <Button type="submit" variant="secondary" className="hidden lg:inline-flex">
          Lọc
        </Button>
      </AutoSubmitForm>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          Không tải được danh sách sản phẩm.
        </p>
      ) : rows.length === 0 ? (
        <EmptyState title="Không có sản phẩm phù hợp">Thử bỏ bớt bộ lọc hoặc tìm bằng từ khác.</EmptyState>
      ) : (
        <>
        <p className="mb-2 text-sm text-muted-foreground">{formatNumber(count ?? rows.length)} sản phẩm</p>
        <ul className="space-y-2 md:hidden" aria-label="Danh sách sản phẩm">
          {rows.map((p) => {
            const stock = stockOf(p);
            return (
              <li key={p.id}>
                <Link href={`/products/${p.id}`} className="flex items-start justify-between gap-3 rounded-xl border bg-card p-3.5 active:bg-muted">
                  <div className="min-w-0">
                    <div className="line-clamp-2 font-medium">{p.name}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {GOODS_TYPE_LABEL[p.goods_type]} - {p.unit} - {p.sku}
                    </div>
                    {p.status === "inactive" && (
                      <Badge variant="outline" className="mt-1">
                        Ngừng bán
                      </Badge>
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
                <TableHead>SKU</TableHead>
                <TableHead>Mã vạch</TableHead>
                <TableHead className="min-w-64">Tên</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead>ĐVT</TableHead>
                <TableHead className="text-right">Giá bán</TableHead>
                <TableHead className="text-right">Giá vốn TC</TableHead>
                <TableHead className="text-right">% Benefit</TableHead>
                <TableHead className="text-right">Tồn</TableHead>
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
                      {p.categories && <div className="text-xs text-muted-foreground">{p.categories.name}</div>}
                    </TableCell>
                    <TableCell>{GOODS_TYPE_LABEL[p.goods_type]}</TableCell>
                    <TableCell>{p.unit}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(p.sell_price)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(p.cost_price_ref)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.pricing_method === "benefit" && pct != null ? `${pct}%` : "-"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(stock)}</TableCell>
                    <TableCell>
                      <Badge variant={p.status === "active" ? "secondary" : "outline"}>
                        {p.status === "active" ? "Đang bán" : "Ngừng bán"}
                      </Badge>
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
        total={count ?? 0}
        basePath="/products"
        params={{ q: sp.q, type: sp.type, status: sp.status, cat: sp.cat, missing: sp.missing }}
      />
    </div>
  );
}
