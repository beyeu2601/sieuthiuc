import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, formatNumber } from "@/lib/format";
import { GOODS_TYPE_LABEL, ilikeTerm } from "@/lib/text";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { EmptyState } from "@/components/empty-state";
import { NativeSelect } from "@/components/native-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

type SP = { q?: string; type?: string; status?: string; cat?: string; page?: string };

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

  const { data, count, error } = await query.returns<Row[]>();
  const rows = data ?? [];

  return (
    <div>
      <PageHeader
        title="Sản phẩm"
        description="Danh mục dùng chung cho mọi cửa hàng. Tồn là tổng các cửa hàng bạn được xem."
        actions={
          canEdit && (
            <>
              <Button variant="outline" render={<Link href="/products/price-suggestions" />}>
                Gợi ý giá
              </Button>
              <Button variant="outline" render={<Link href="/products/import" />}>
                Import Excel
              </Button>
              <Button render={<Link href="/products/new" />}>Thêm sản phẩm</Button>
            </>
          )
        }
      />

      <form className="mb-3 grid gap-2 sm:grid-cols-[1fr_140px_160px_200px_auto]" role="search">
        <Input name="q" defaultValue={sp.q} placeholder="Tìm tên, SKU hoặc quét mã vạch" aria-label="Tìm sản phẩm" />
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
        <Button type="submit" variant="secondary">
          Lọc
        </Button>
      </form>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          Không tải được danh sách sản phẩm.
        </p>
      ) : rows.length === 0 ? (
        <EmptyState title="Không có sản phẩm phù hợp">Thử bỏ bớt bộ lọc hoặc tìm bằng từ khác.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
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
                const stock = p.inventory.reduce((s, i) => s + Number(i.qty_on_hand), 0);
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
      )}
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={count ?? 0}
        basePath="/products"
        params={{ q: sp.q, type: sp.type, status: sp.status, cat: sp.cat }}
      />
    </div>
  );
}
