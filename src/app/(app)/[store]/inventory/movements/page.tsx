import Link from "next/link";
import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { NativeSelect } from "@/components/native-select";
import { Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InventoryTabs } from "../inventory-tabs";
import { MOVEMENT_LABEL } from "../labels";

export const metadata = { title: "Lịch sử biến động kho" };
const PAGE_SIZE = 100;

type Row = {
  id: string;
  created_at: string;
  product_id: string;
  sku: string;
  name: string;
  movement_type: string;
  qty_delta: number;
  qty_before: number;
  qty_after: number;
  unit_cost: number | null;
  lot_no: string | null;
  ref_type: string | null;
  ref_id: string | null;
  ref_code: string | null;
  note: string | null;
  performed_by_name: string | null;
  total_count: number;
};

function refHref(store: string, r: Row) {
  if (!r.ref_id) return null;
  if (r.ref_type === "purchase_receipt") return `/${store}/receipts/${r.ref_id}`;
  if (r.ref_type === "stock_transfer") return `/${store}/transfers/${r.ref_id}`;
  if (r.ref_type === "sale") return `/${store}/sales/${r.ref_id}`;
  if (r.ref_type === "order") return `/${store}/orders/${r.ref_id}`;
  return null;
}

type SP = { from?: string; to?: string; type?: string; product?: string; page?: string };

export default async function MovementsPage({ params, searchParams }: { params: Promise<{ store: string }>; searchParams: Promise<SP> }) {
  const { store: code } = await params;
  const sp = await searchParams;
  const { ctx, store } = await requireStore(code);
  const isStaff = ctx.profile.role === "staff";
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("stock_movement_list", {
    p_store_id: store.id,
    p_from: sp.from || null,
    p_to: sp.to || null,
    p_product_id: /^[0-9a-f-]{36}$/i.test(sp.product ?? "") ? sp.product : null,
    p_type: sp.type && sp.type in MOVEMENT_LABEL ? sp.type : null,
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
  });
  const rows = (data ?? []) as Row[];

  return (
    <div>
      <PageHeader title="Lịch sử biến động kho" description="Mỗi lần tồn thay đổi đều có một dòng, kèm chứng từ nguồn." />
      <InventoryTabs storeCode={store.code} />
      <form className="my-3 grid gap-2 sm:grid-cols-[150px_150px_200px_auto]">
        <Input type="date" name="from" defaultValue={sp.from} aria-label="Từ ngày" />
        <Input type="date" name="to" defaultValue={sp.to} aria-label="Đến ngày" />
        <NativeSelect name="type" defaultValue={sp.type ?? ""} aria-label="Loại biến động">
          <option value="">Mọi loại</option>
          {Object.entries(MOVEMENT_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </NativeSelect>
        {sp.product && <input type="hidden" name="product" value={sp.product} />}
        <Button type="submit" variant="secondary">
          Lọc
        </Button>
      </form>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          Không tải được lịch sử.
        </p>
      ) : rows.length === 0 ? (
        <EmptyState title="Không có biến động trong khoảng đã chọn" />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thời gian</TableHead>
                <TableHead className="min-w-52">Sản phẩm</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead className="text-right">Thay đổi</TableHead>
                <TableHead className="text-right">Trước</TableHead>
                <TableHead className="text-right">Sau</TableHead>
                {!isStaff && <TableHead className="text-right">Giá vốn</TableHead>}
                <TableHead>Lô</TableHead>
                <TableHead>Chứng từ</TableHead>
                <TableHead>Người thực hiện</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const href = refHref(store.code, r);
                const d = Number(r.qty_delta);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{formatDateTime(r.created_at)}</TableCell>
                    <TableCell>
                      <Link href={`?product=${r.product_id}`} className="hover:underline">
                        {r.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">{r.sku}</div>
                    </TableCell>
                    <TableCell>{MOVEMENT_LABEL[r.movement_type] ?? r.movement_type}</TableCell>
                    <TableCell className={`text-right tabular-nums ${d > 0 ? "text-success" : d < 0 ? "text-destructive" : ""}`}>
                      {d > 0 ? "+" : ""}
                      {formatNumber(d)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(r.qty_before)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(r.qty_after)}</TableCell>
                    {!isStaff && <TableCell className="text-right tabular-nums">{formatMoney(r.unit_cost)}</TableCell>}
                    <TableCell>{r.lot_no ?? "-"}</TableCell>
                    <TableCell>
                      {href ? (
                        <Link href={href} className="underline underline-offset-4">
                          {r.ref_code ?? "Xem"}
                        </Link>
                      ) : (
                        (r.note ?? "-")
                      )}
                    </TableCell>
                    <TableCell>{r.performed_by_name ?? "-"}</TableCell>
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
        total={Number(rows[0]?.total_count ?? 0)}
        basePath={`/${store.code}/inventory/movements`}
        params={{ from: sp.from, to: sp.to, type: sp.type, product: sp.product }}
      />
    </div>
  );
}
