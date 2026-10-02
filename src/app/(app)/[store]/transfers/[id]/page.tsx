import { notFound } from "next/navigation";
import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Khoi } from "@/components/khoi";
import { ChipSac } from "@/components/ui/chip";
import { ChiSo, HangChiSo } from "@/components/ui/chi-so";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TRANSFER_STATUS } from "../labels";
import { TransferButtons } from "./transfer-buttons";

// Ngay va gio rieng de o chi so khong bi cat chu tren dien thoai
const VN = { timeZone: "Asia/Ho_Chi_Minh" } as const;
const ngay = (v: string) => new Intl.DateTimeFormat("vi-VN", { ...VN, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(v));
const gio = (v: string) => new Intl.DateTimeFormat("vi-VN", { ...VN, hour: "2-digit", minute: "2-digit" }).format(new Date(v));

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
  const cancelled = t.status === "cancelled";

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Phiếu chuyển ${t.code}`}
        description={
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <ChipSac sac={st.sac}>{st.label}</ChipSac>
            <ChipSac sac="slate" title={`${from.name} -> ${to.name}`}>
              {from.code} {"->"} {to.code}
            </ChipSac>
            <ChipSac sac="slate">{isFrom ? "Chuyển đi" : "Chuyển đến"}</ChipSac>
          </span>
        }
        actions={canAct ? <TransferButtons storeCode={store.code} id={t.id} status={t.status} isFrom={isFrom} /> : undefined}
      />

      <HangChiSo>
        <ChiSo nhan="Dòng hàng" sac="brand" giaTri={formatNumber((items ?? []).length)} phu={`${formatNumber(ids.length)} sản phẩm`} />
        <ChiSo
          nhan={t.sent_at ? "Đã gửi" : cancelled ? "Không gửi" : "Chưa gửi"}
          sac={t.sent_at ? "emerald" : cancelled ? "slate" : "amber"}
          giaTri={t.sent_at ? ngay(t.sent_at) : "-"}
          phu={t.sent_at ? `Lúc ${gio(t.sent_at)} từ ${from.code}` : cancelled ? "Phiếu đã hủy" : "Tồn cửa hàng gửi chưa giảm"}
        />
        <ChiSo
          nhan={t.received_at ? "Đã nhận" : cancelled ? "Đã hủy" : t.status === "sent" ? "Chờ nhận" : "Chưa nhận"}
          sac={t.received_at ? "emerald" : cancelled ? "red" : t.status === "sent" ? "amber" : "slate"}
          giaTri={t.received_at ? ngay(t.received_at) : "-"}
          phu={
            t.received_at ? `Lúc ${gio(t.received_at)} tại ${to.code}` : t.status === "sent" ? `${to.code} cần xác nhận đã nhận` : `Về ${to.code}`
          }
        />
      </HangChiSo>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <Khoi title="Hàng chuyển" className="min-w-0" aside={<span className="text-xs text-muted-foreground tabular-nums">{(items ?? []).length} dòng</span>}>
          <div className="overflow-x-auto">
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
        </Khoi>

        <Khoi title="Thông tin" className="min-w-0">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Gửi</dt>
            <dd className="text-right">
              {from.code} - {from.name}
            </dd>
            <dt className="text-muted-foreground">Nhận</dt>
            <dd className="text-right">
              {to.code} - {to.name}
            </dd>
            <dt className="text-muted-foreground">Tạo lúc</dt>
            <dd className="text-right">{formatDateTime(t.created_at)}</dd>
            {t.note && (
              <>
                <dt className="text-muted-foreground">Ghi chú</dt>
                <dd className="text-right whitespace-pre-line">{t.note}</dd>
              </>
            )}
          </dl>
        </Khoi>
      </div>
    </div>
  );
}
