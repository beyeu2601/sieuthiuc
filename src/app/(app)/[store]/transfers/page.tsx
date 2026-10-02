import Link from "next/link";
import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { GoiY } from "@/components/goi-y";
import { EmptyState } from "@/components/empty-state";
import { ChipSac } from "@/components/ui/chip";
import { ChiSo, HangChiSo } from "@/components/ui/chi-so";
import { MobileCard, MobileCardList } from "@/components/mobile-card";
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
  // Dem tu chinh cac dong da tai (toi da 200 phieu moi nhat), khong them truy van
  const waitingIn = rows.filter((t) => t.status === "sent" && t.to_store_id === store.id).length;
  const sendingOut = rows.filter((t) => t.status === "sent" && t.from_store_id === store.id).length;
  const drafts = rows.filter((t) => t.status === "draft" && t.from_store_id === store.id).length;

  return (
    <div>
      <PageHeader
        title="Chuyển kho"
        description={<GoiY label="Chuyển kho">Hàng đang chuyển không thuộc tồn của cửa hàng nào cho tới khi bên nhận xác nhận.</GoiY>}
        actions={canCreate && <Button render={<Link href={`/${store.code}/transfers/new`} />}>Tạo phiếu chuyển</Button>}
      />
      {rows.length > 0 && (
        <HangChiSo className="mb-4">
          <ChiSo
            nhan={waitingIn > 0 ? "Chờ cửa hàng này nhận" : "Không có hàng chờ nhận"}
            sac={waitingIn > 0 ? "amber" : "emerald"}
            giaTri={waitingIn}
            phu="Đang chuyển đến, cần xác nhận"
          />
          <ChiSo nhan="Đang chuyển đi" sac="slate" giaTri={sendingOut} phu="Chờ bên nhận xác nhận" />
          <ChiSo
            nhan={drafts > 0 ? "Nháp chưa gửi" : "Không có nháp"}
            sac={drafts > 0 ? "amber" : "slate"}
            giaTri={drafts}
            phu="Tồn cửa hàng gửi chưa giảm"
          />
        </HangChiSo>
      )}
      {rows.length === 0 ? (
        <EmptyState title="Chưa có phiếu chuyển kho" />
      ) : (
        <>
          <MobileCardList label="Phiếu chuyển kho">
            {rows.map((t) => {
              const st = TRANSFER_STATUS[t.status as keyof typeof TRANSFER_STATUS];
              return (
                <MobileCard
                  key={t.id}
                  title={
                    <Link href={`/${store.code}/transfers/${t.id}`} className="underline-offset-4 hover:underline">
                      {t.code}
                    </Link>
                  }
                  subtitle={formatDateTime(t.created_at)}
                  badge={<ChipSac sac={st.sac}>{st.label}</ChipSac>}
                  stats={[
                    { label: "Chiều", value: `${storeCode.get(t.from_store_id)} -> ${storeCode.get(t.to_store_id)}` },
                    { label: "Hướng", value: t.from_store_id === store.id ? "Chuyển đi" : "Chuyển đến" },
                  ]}
                />
              );
            })}
          </MobileCardList>
          <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
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
    </div>
  );
}
