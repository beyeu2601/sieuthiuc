import Link from "next/link";
import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { NativeSelect } from "@/components/native-select";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RECEIPT_STATUS } from "./labels";

export const metadata = { title: "Nhập hàng" };
const PAGE_SIZE = 50;

type SP = { status?: string; supplier?: string; from?: string; to?: string; page?: string };

export default async function ReceiptsPage({ params, searchParams }: { params: Promise<{ store: string }>; searchParams: Promise<SP> }) {
  const { store: code } = await params;
  const sp = await searchParams;
  const { ctx, store } = await requireStore(code);
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();

  const { data: suppliers } = await supabase.from("suppliers").select("id, name").order("name");
  let q = supabase
    .from("purchase_receipts")
    .select("id, code, receipt_date, invoice_no, status, total, paid_amount, suppliers(name)", { count: "exact" })
    .eq("store_id", store.id)
    .order("receipt_date", { ascending: false })
    .order("code", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (sp.status && sp.status in RECEIPT_STATUS) q = q.eq("status", sp.status);
  if (sp.supplier) q = q.eq("supplier_id", sp.supplier);
  if (sp.from) q = q.gte("receipt_date", sp.from);
  if (sp.to) q = q.lte("receipt_date", sp.to);
  const { data, count } = await q;
  const rows = data ?? [];
  const canCreate = ctx.profile.role !== "accountant";

  return (
    <div>
      <PageHeader
        title="Nhập hàng"
        description="Phiếu nhập theo cửa hàng. Chỉ phiếu đã xác nhận mới cộng tồn và sinh công nợ."
        actions={canCreate && <Button render={<Link href={`/${store.code}/receipts/new`} />}>Tạo phiếu nhập</Button>}
      />
      <form className="mb-3 grid gap-2 sm:grid-cols-[160px_1fr_150px_150px_auto]">
        <NativeSelect name="status" defaultValue={sp.status ?? ""} aria-label="Trạng thái">
          <option value="">Mọi trạng thái</option>
          <option value="draft">Nháp</option>
          <option value="confirmed">Đã nhập kho</option>
          <option value="cancelled">Đã hủy</option>
        </NativeSelect>
        <NativeSelect name="supplier" defaultValue={sp.supplier ?? ""} aria-label="Nhà cung cấp">
          <option value="">Mọi nhà cung cấp</option>
          {(suppliers ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </NativeSelect>
        <Input type="date" name="from" defaultValue={sp.from} aria-label="Từ ngày" />
        <Input type="date" name="to" defaultValue={sp.to} aria-label="Đến ngày" />
        <Button type="submit" variant="secondary">
          Lọc
        </Button>
      </form>
      {rows.length === 0 ? (
        <EmptyState title="Chưa có phiếu nhập">Tạo phiếu nhập để đưa hàng vào kho.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã phiếu</TableHead>
                <TableHead>Ngày</TableHead>
                <TableHead>Nhà cung cấp</TableHead>
                <TableHead>Số HĐ</TableHead>
                <TableHead className="text-right">Tổng</TableHead>
                <TableHead className="text-right">Còn nợ</TableHead>
                <TableHead>Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const st = RECEIPT_STATUS[r.status as keyof typeof RECEIPT_STATUS];
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link href={`/${store.code}/receipts/${r.id}`} className="font-medium hover:underline">
                        {r.code}
                      </Link>
                    </TableCell>
                    <TableCell>{new Date(r.receipt_date).toLocaleDateString("vi-VN")}</TableCell>
                    <TableCell>{(r.suppliers as unknown as { name: string } | null)?.name}</TableCell>
                    <TableCell>{r.invoice_no ?? "-"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(r.total)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.status === "confirmed" ? formatMoney(r.total - r.paid_amount) : "-"}
                    </TableCell>
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
        total={count ?? 0}
        basePath={`/${store.code}/receipts`}
        params={{ status: sp.status, supplier: sp.supplier, from: sp.from, to: sp.to }}
      />
    </div>
  );
}
