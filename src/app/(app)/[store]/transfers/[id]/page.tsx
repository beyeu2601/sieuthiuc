import { notFound } from "next/navigation";
import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TRANSFER_STATUS } from "../labels";
import { TransferButtons } from "./transfer-buttons";

export default async function TransferPage({ params }: { params: Promise<{ store: string; id: string }> }) {
  const { store: code, id } = await params;
  const { ctx, store } = await requireStore(code);
  const supabase = await createClient();
  const { data: t } = await supabase
    .from("stock_transfers")
    .select("id, code, status, note, from_store_id, to_store_id, created_at, sent_at, received_at")
    .eq("id", id)
    .maybeSingle();
  if (!t) notFound();
  const { data: items } = await supabase
    .from("stock_transfer_items")
    .select("id, product_id, qty, stock_lots(lot_no, expiry_date)")
    .eq("transfer_id", id);
  const ids = [...new Set((items ?? []).map((i) => i.product_id))];
  const { data: prods } = ids.length ? await supabase.rpc("catalog_by_ids", { p_ids: ids }) : { data: [] };
  const pmap = new Map(((prods ?? []) as { product_id: string; name: string; unit: string }[]).map((p) => [p.product_id, p]));
  const st = TRANSFER_STATUS[t.status as keyof typeof TRANSFER_STATUS];
  const { data: storeOpts } = await supabase.rpc("active_store_options");
  const smap = new Map(((storeOpts ?? []) as { id: string; code: string; name: string }[]).map((s) => [s.id, s]));
  const from = smap.get(t.from_store_id) ?? { code: "?", name: "" };
  const to = smap.get(t.to_store_id) ?? { code: "?", name: "" };
  const isFrom = t.from_store_id === store.id;
  const canAct = ctx.profile.role !== "accountant";

  return (
    <div className="max-w-4xl space-y-4">
      <PageHeader
        title={`Phiếu chuyển ${t.code}`}
        description={
          <span className="flex items-center gap-2">
            <Badge variant={st.variant}>{st.label}</Badge>
            {from.code} - {from.name} {"->"} {to.code} - {to.name}
          </span>
        }
      />
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sản phẩm</TableHead>
              <TableHead>Lô</TableHead>
              <TableHead>HSD</TableHead>
              <TableHead className="text-right">Số lượng</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(items ?? []).map((i) => {
              const lot = i.stock_lots as unknown as { lot_no: string; expiry_date: string | null } | null;
              const p = pmap.get(i.product_id);
              return (
                <TableRow key={i.id}>
                  <TableCell>{p?.name}</TableCell>
                  <TableCell>{lot?.lot_no}</TableCell>
                  <TableCell>{lot?.expiry_date ? new Date(lot.expiry_date).toLocaleDateString("vi-VN") : "-"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(i.qty)} {p?.unit}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="text-sm text-muted-foreground">
        <p>Tạo lúc {formatDateTime(t.created_at)}</p>
        {t.sent_at && <p>Gửi lúc {formatDateTime(t.sent_at)}</p>}
        {t.received_at && <p>Nhận lúc {formatDateTime(t.received_at)}</p>}
        {t.note && <p className="text-foreground">Ghi chú: {t.note}</p>}
      </div>
      {canAct && <TransferButtons storeCode={store.code} id={t.id} status={t.status} isFrom={isFrom} />}
    </div>
  );
}
