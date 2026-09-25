import Link from "next/link";
import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { NativeSelect } from "@/components/native-select";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CHANNEL_LABEL, SALE_STATUS } from "./labels";

export const metadata = { title: "Giao dịch bán" };
const PAGE_SIZE = 50;

type SP = { from?: string; to?: string; status?: string; channel?: string; q?: string; page?: string };

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
}

export default async function SalesPage({ params, searchParams }: { params: Promise<{ store: string }>; searchParams: Promise<SP> }) {
  const { store: code } = await params;
  const sp = await searchParams;
  const { store } = await requireStore(code);
  const page = Math.max(1, Number(sp.page) || 1);
  const from = sp.from ?? today();
  const to = sp.to ?? today();
  const supabase = await createClient();

  let q = supabase
    .from("sales")
    .select("id, code, completed_at, channel, status, subtotal, discount_amount, total, creator:created_by(full_name), sale_payments(method)", {
      count: "exact",
    })
    .eq("store_id", store.id)
    .gte("completed_at", `${from}T00:00:00+07:00`)
    .lte("completed_at", `${to}T23:59:59.999+07:00`)
    .order("completed_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (sp.status && sp.status in SALE_STATUS) q = q.eq("status", sp.status);
  if (sp.channel && sp.channel in CHANNEL_LABEL) q = q.eq("channel", sp.channel);
  if (sp.q?.trim()) q = q.ilike("code", `%${sp.q.trim()}%`);
  const { data, count } = await q;
  const rows = data ?? [];
  const completedTotal = rows.filter((r) => r.status === "completed").reduce((s, r) => s + r.total, 0);

  return (
    <div>
      <PageHeader
        title="Giao dịch bán"
        description="Giao dịch đã hủy vẫn hiện trong lịch sử nhưng không tính doanh thu."
        actions={<Button render={<Link href={`/${store.code}/pos`} />}>Bán hàng</Button>}
      />
      <form className="mb-3 grid gap-2 sm:grid-cols-[150px_150px_150px_150px_1fr_auto]">
        <Input type="date" name="from" defaultValue={from} aria-label="Từ ngày" />
        <Input type="date" name="to" defaultValue={to} aria-label="Đến ngày" />
        <NativeSelect name="status" defaultValue={sp.status ?? ""} aria-label="Trạng thái">
          <option value="">Mọi trạng thái</option>
          <option value="completed">Hoàn tất</option>
          <option value="cancelled">Đã hủy</option>
        </NativeSelect>
        <NativeSelect name="channel" defaultValue={sp.channel ?? ""} aria-label="Kênh">
          <option value="">Mọi kênh</option>
          {Object.entries(CHANNEL_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </NativeSelect>
        <Input name="q" defaultValue={sp.q} placeholder="Mã hóa đơn" aria-label="Mã hóa đơn" />
        <Button type="submit" variant="secondary">
          Lọc
        </Button>
      </form>
      {rows.length === 0 ? (
        <EmptyState title="Không có giao dịch trong khoảng đã chọn" />
      ) : (
        <>
          <p className="mb-2 text-sm">
            Trang này: tổng giao dịch hoàn tất <strong className="tabular-nums">{formatMoney(completedTotal)}</strong>
          </p>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã</TableHead>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Kênh</TableHead>
                  <TableHead>Nhân viên</TableHead>
                  <TableHead className="text-right">Giảm giá</TableHead>
                  <TableHead className="text-right">Tổng</TableHead>
                  <TableHead>Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const st = SALE_STATUS[r.status as keyof typeof SALE_STATUS];
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Link href={`/${store.code}/sales/${r.id}`} className="font-medium hover:underline">
                          {r.code}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatDateTime(r.completed_at)}</TableCell>
                      <TableCell>{CHANNEL_LABEL[r.channel as keyof typeof CHANNEL_LABEL]}</TableCell>
                      <TableCell>{(r.creator as unknown as { full_name: string } | null)?.full_name ?? "-"}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.discount_amount ? formatMoney(r.discount_amount) : "-"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(r.total)}</TableCell>
                      <TableCell>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={count ?? 0}
        basePath={`/${store.code}/sales`}
        params={{ from, to, status: sp.status, channel: sp.channel, q: sp.q }}
      />
    </div>
  );
}
