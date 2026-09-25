import Link from "next/link";
import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TRANSFER_STATUS } from "./labels";

export const metadata = { title: "Chuyển kho" };

export default async function TransfersPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: code } = await params;
  const { ctx, store } = await requireStore(code);
  const supabase = await createClient();
  const [{ data }, { data: storeOpts }] = await Promise.all([
    supabase
    .from("stock_transfers")
    .select("id, code, status, created_at, sent_at, received_at, from_store_id, to_store_id")
    .or(`from_store_id.eq.${store.id},to_store_id.eq.${store.id}`)
    .order("created_at", { ascending: false })
    .limit(200),
    supabase.rpc("active_store_options"),
  ]);
  const rows = data ?? [];
  const storeCode = new Map(((storeOpts ?? []) as { id: string; code: string }[]).map((s) => [s.id, s.code]));
  const canCreate = ctx.profile.role !== "accountant";

  return (
    <div>
      <PageHeader
        title="Chuyển kho"
        description="Chuyển hàng giữa các cửa hàng. Hàng đang chuyển không thuộc tồn của cửa hàng nào cho tới khi bên nhận xác nhận."
        actions={canCreate && <Button render={<Link href={`/${store.code}/transfers/new`} />}>Tạo phiếu chuyển</Button>}
      />
      {rows.length === 0 ? (
        <EmptyState title="Chưa có phiếu chuyển kho" />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã phiếu</TableHead>
                <TableHead>Chiều</TableHead>
                <TableHead>Tạo lúc</TableHead>
                <TableHead>Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => {
                const st = TRANSFER_STATUS[t.status as keyof typeof TRANSFER_STATUS];
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Link href={`/${store.code}/transfers/${t.id}`} className="font-medium hover:underline">
                        {t.code}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {storeCode.get(t.from_store_id)} {"->"} {storeCode.get(t.to_store_id)}
                      <span className="ml-2 text-xs text-muted-foreground">{t.from_store_id === store.id ? "Chuyển đi" : "Chuyển đến"}</span>
                    </TableCell>
                    <TableCell>{formatDateTime(t.created_at)}</TableCell>
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
    </div>
  );
}
