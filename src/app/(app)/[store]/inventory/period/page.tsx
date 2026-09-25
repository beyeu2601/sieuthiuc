import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/format";
import { GOODS_TYPE_LABEL } from "@/lib/text";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InventoryTabs } from "../inventory-tabs";

export const metadata = { title: "Nhập xuất tồn theo kỳ" };

type Row = {
  product_id: string;
  sku: string;
  name: string;
  unit: string;
  goods_type: "cont" | "air";
  opening: number;
  qty_in: number;
  qty_out: number;
  qty_adjust: number;
  closing: number;
};

function monthStart() {
  const d = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
  return `${d.slice(0, 8)}01`;
}
function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
}

export default async function PeriodPage({
  params,
  searchParams,
}: {
  params: Promise<{ store: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { store: code } = await params;
  const sp = await searchParams;
  const { store } = await requireStore(code);
  const from = sp.from || monthStart();
  const to = sp.to || today();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("inventory_period", { p_store_id: store.id, p_from: from, p_to: to });
  const rows = ((data ?? []) as Row[]).map((r) => ({
    ...r,
    opening: Number(r.opening),
    qty_in: Number(r.qty_in),
    qty_out: Number(r.qty_out),
    qty_adjust: Number(r.qty_adjust),
    closing: Number(r.closing),
  }));
  const sum = (k: keyof Row) => rows.reduce((s, r) => s + (r[k] as number), 0);

  return (
    <div>
      <PageHeader title="Nhập xuất tồn theo kỳ" description="Tồn cuối = tồn đầu + nhập - xuất + điều chỉnh, tính từ lịch sử biến động." />
      <InventoryTabs storeCode={store.code} />
      <form className="my-3 flex flex-wrap items-end gap-2">
        <label className="space-y-1 text-sm">
          Từ ngày
          <Input type="date" name="from" defaultValue={from} />
        </label>
        <label className="space-y-1 text-sm">
          Đến ngày
          <Input type="date" name="to" defaultValue={to} />
        </label>
        <Button type="submit" variant="secondary">
          Xem
        </Button>
      </form>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          Không tải được số liệu.
        </p>
      ) : rows.length === 0 ? (
        <EmptyState title="Không có phát sinh trong kỳ" />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-56">Sản phẩm</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead className="text-right">Tồn đầu</TableHead>
                <TableHead className="text-right">Nhập</TableHead>
                <TableHead className="text-right">Xuất</TableHead>
                <TableHead className="text-right">Điều chỉnh</TableHead>
                <TableHead className="text-right">Tồn cuối</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.product_id}>
                  <TableCell className="min-w-56 whitespace-normal">
                    {r.name}
                    <div className="text-xs text-muted-foreground">
                      {r.sku} - {r.unit}
                    </div>
                  </TableCell>
                  <TableCell>{GOODS_TYPE_LABEL[r.goods_type]}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(r.opening)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(r.qty_in)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(r.qty_out)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(r.qty_adjust)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatNumber(r.closing)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2}>Tổng {rows.length} sản phẩm</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(sum("opening"))}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(sum("qty_in"))}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(sum("qty_out"))}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(sum("qty_adjust"))}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(sum("closing"))}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </div>
  );
}
