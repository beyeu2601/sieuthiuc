import Link from "next/link";
import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getNumberSetting } from "@/lib/settings";
import { formatMoney, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InventoryTabs } from "../inventory/inventory-tabs";
import type { LotRow } from "../catalog-actions";
import { cn } from "@/lib/utils";

export const metadata = { title: "Hạn sử dụng" };

export default async function ExpiryPage({
  params,
  searchParams,
}: {
  params: Promise<{ store: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { store: code } = await params;
  const { tab = "near" } = await searchParams;
  const { ctx, store } = await requireStore(code);
  const isStaff = ctx.profile.role === "staff";
  const supabase = await createClient();
  const status = tab === "expired" ? "expired" : "near";
  const [{ data }, nearDays] = await Promise.all([
    supabase.rpc("lot_expiry", { p_store_id: store.id, p_status: status }),
    getNumberSetting("inventory.near_expiry_days", 30, store.id),
  ]);
  const rows = (data ?? []) as LotRow[];
  const value = rows.reduce((s, r) => s + Number(r.qty_on_hand) * (r.unit_cost ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Hạn sử dụng"
        description={`Lô còn hàng gần hết hạn (trong ${nearDays} ngày) hoặc đã hết hạn. Hàng hết hạn bị chặn khi bán.`}
      />
      <InventoryTabs storeCode={store.code} />
      <div className="my-3 flex gap-1" role="tablist">
        {[
          { k: "near", label: "Gần hết hạn" },
          { k: "expired", label: "Đã hết hạn" },
        ].map((t) => (
          <Link
            key={t.k}
            href={`?tab=${t.k}`}
            role="tab"
            aria-selected={status === t.k}
            className={cn(
              "inline-flex h-9 items-center rounded-lg border px-3 text-sm",
              status === t.k ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <EmptyState title={status === "near" ? "Không có lô nào sắp hết hạn" : "Không có lô nào đã hết hạn"} />
      ) : (
        <>
          {!isStaff && (
            <p className="mb-2 text-sm">
              {rows.length} lô, giá trị theo giá vốn <strong>{formatMoney(value)}</strong>. Hủy hàng hết hạn làm ở phiếu hủy hàng (giai đoạn 2).
            </p>
          )}
          <div className="overflow-x-auto rounded-xl border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-56">Sản phẩm</TableHead>
                  <TableHead>Lô</TableHead>
                  <TableHead>Hạn sử dụng</TableHead>
                  <TableHead className="text-right">Còn (ngày)</TableHead>
                  <TableHead className="text-right">Số lượng</TableHead>
                  {!isStaff && <TableHead className="text-right">Giá vốn lô</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.lot_id}>
                    <TableCell>
                      {r.name}
                      <div className="text-xs text-muted-foreground">{r.sku}</div>
                    </TableCell>
                    <TableCell>{r.lot_no}</TableCell>
                    <TableCell>{r.expiry_date ? new Date(r.expiry_date).toLocaleDateString("vi-VN") : "-"}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={r.expiry_status === "expired" ? "destructive" : "outline"}>
                        {r.days_left != null && r.days_left < 0 ? `Quá ${-r.days_left}` : r.days_left}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(r.qty_on_hand)} {r.unit}
                    </TableCell>
                    {!isStaff && <TableCell className="text-right tabular-nums">{formatMoney(r.unit_cost)}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
