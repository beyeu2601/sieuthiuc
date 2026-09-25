import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ilikeTerm } from "@/lib/text";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { NativeSelect } from "@/components/native-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata = { title: "Nhà cung cấp" };

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  await requireRole("sadmin", "admin", "accountant");
  const sp = await searchParams;
  const status = sp.status ?? "active";
  const supabase = await createClient();
  let query = supabase
    .from("suppliers")
    .select("id, code, name, contact_name, phone, payment_terms_days, is_active")
    .order("name")
    .limit(500);
  if (sp.q?.trim()) query = query.ilike("search_key", ilikeTerm(sp.q));
  if (status !== "all") query = query.eq("is_active", status === "active");
  const { data, error } = await query;
  const rows = data ?? [];

  return (
    <div>
      <PageHeader title="Nhà cung cấp" actions={<Button render={<Link href="/suppliers/new" />}>Thêm nhà cung cấp</Button>} />
      <form className="mb-3 grid gap-2 sm:grid-cols-[1fr_180px_auto]" role="search">
        <Input name="q" defaultValue={sp.q} placeholder="Tìm tên, mã, số điện thoại" aria-label="Tìm nhà cung cấp" />
        <NativeSelect name="status" defaultValue={status} aria-label="Trạng thái">
          <option value="active">Đang giao dịch</option>
          <option value="inactive">Ngừng giao dịch</option>
          <option value="all">Tất cả</option>
        </NativeSelect>
        <Button type="submit" variant="secondary">
          Lọc
        </Button>
      </form>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          Không tải được danh sách.
        </p>
      ) : rows.length === 0 ? (
        <EmptyState title="Chưa có nhà cung cấp">Thêm nhà cung cấp trước khi tạo phiếu nhập hàng.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã</TableHead>
                <TableHead>Tên</TableHead>
                <TableHead>Liên hệ</TableHead>
                <TableHead>Điện thoại</TableHead>
                <TableHead className="text-right">Ngày được nợ</TableHead>
                <TableHead>Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link href={`/suppliers/${s.id}`} className="font-medium hover:underline">
                      {s.code}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/suppliers/${s.id}`} className="hover:underline">
                      {s.name}
                    </Link>
                  </TableCell>
                  <TableCell>{s.contact_name ?? "-"}</TableCell>
                  <TableCell>{s.phone ?? "-"}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.payment_terms_days}</TableCell>
                  <TableCell>
                    <Badge variant={s.is_active ? "secondary" : "outline"}>{s.is_active ? "Đang giao dịch" : "Ngừng"}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
