import Link from "next/link";
import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, formatNumber } from "@/lib/format";
import { GOODS_TYPE_LABEL } from "@/lib/text";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { NativeSelect } from "@/components/native-select";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
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

type SP = { q?: string; status?: string; type?: string; cat?: string; page?: string };

export default async function InventoryPage({ params, searchParams }: { params: Promise<{ store: string }>; searchParams: Promise<SP> }) {
  const { store: code } = await params;
  const sp = await searchParams;
  const { ctx, store } = await requireStore(code);
  const isStaff = ctx.profile.role === "staff";
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();

  const [{ data: cats }, { data, error }] = await Promise.all([
    supabase.from("categories").select("id, name").order("name"),
    supabase.rpc("inventory_status", {
      p_store_id: store.id,
      p_q: sp.q || null,
      p_status: sp.status || null,
      p_category: sp.cat || null,
      p_goods_type: sp.type === "cont" || sp.type === "air" ? sp.type : null,
      p_limit: PAGE_SIZE,
      p_offset: (page - 1) * PAGE_SIZE,
    }),
  ]);
  const rows = (data ?? []) as Row[];
  const total = rows[0]?.total_count ?? 0;

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
      <form className="my-3 grid gap-2 sm:grid-cols-[1fr_150px_130px_180px_auto]" role="search">
        <Input name="q" defaultValue={sp.q} placeholder="Tìm tên, SKU hoặc quét mã" aria-label="Tìm sản phẩm" />
        <NativeSelect name="status" defaultValue={sp.status ?? ""} aria-label="Trạng thái tồn">
          <option value="">Mọi trạng thái</option>
          <option value="out">Hết hàng</option>
          <option value="low">Sắp hết</option>
          <option value="in_stock">Còn hàng</option>
        </NativeSelect>
        <NativeSelect name="type" defaultValue={sp.type ?? ""} aria-label="Loại hàng">
          <option value="">Mọi loại</option>
          <option value="cont">Cont</option>
          <option value="air">Air</option>
        </NativeSelect>
        <NativeSelect name="cat" defaultValue={sp.cat ?? ""} aria-label="Nhóm hàng">
          <option value="">Mọi nhóm hàng</option>
          {(cats ?? []).map((c) => (
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
          Không tải được tồn kho.
        </p>
      ) : rows.length === 0 ? (
        <EmptyState title="Không có sản phẩm phù hợp" />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-background">
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
                    <TableCell>
                      {isStaff ? r.name : <Link href={`/products/${r.product_id}`} className="hover:underline">{r.name}</Link>}
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
                      <Badge variant={st.variant}>{st.label}</Badge>
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
        total={Number(total)}
        basePath={`/${store.code}/inventory`}
        params={{ q: sp.q, status: sp.status, type: sp.type, cat: sp.cat }}
      />
    </div>
  );
}
