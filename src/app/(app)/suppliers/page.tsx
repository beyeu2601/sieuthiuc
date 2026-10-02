import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ilikeTerm } from "@/lib/text";
import { PageHeader } from "@/components/page-header";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { FilterBar } from "@/components/filter-bar";
import { EmptyState } from "@/components/empty-state";
import { LuaChon } from "@/components/lua-chon";
import { MobileCard, MobileCardList } from "@/components/mobile-card";
import { ChipSac } from "@/components/ui/chip";
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
    .order("created_at", { ascending: false })
    .limit(500);
  if (sp.q?.trim()) query = query.ilike("search_key", ilikeTerm(sp.q));
  if (status !== "all") query = query.eq("is_active", status === "active");
  const { data, error } = await query;
  const rows = data ?? [];

  return (
    <div>
      <PageHeader title="Nhà cung cấp" actions={<Button render={<Link href="/suppliers/new" />}>Thêm nhà cung cấp</Button>} />
      <AutoSubmitForm action="/suppliers" debounceMs={400} className="mb-3" role="search">
        <FilterBar search={<Input type="search" enterKeyHint="search" name="q" defaultValue={sp.q} placeholder="Tìm tên, mã, số điện thoại" aria-label="Tìm nhà cung cấp" />}>
          <LuaChon
            name="status"
            defaultValue={status}
            aria-label="Trạng thái"
            className="sm:w-96"
            options={[
              { value: "active", label: "Đang giao dịch" },
              { value: "inactive", label: "Ngừng giao dịch" },
              { value: "all", label: "Tất cả" },
            ]}
          />
        </FilterBar>
      </AutoSubmitForm>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          Không tải được danh sách.
        </p>
      ) : rows.length === 0 ? (
        <EmptyState title="Chưa có nhà cung cấp">Thêm nhà cung cấp trước khi tạo phiếu nhập hàng.</EmptyState>
      ) : (
        <>
          <MobileCardList label="Nhà cung cấp">
            {rows.map((s) => (
              <MobileCard
                key={s.id}
                title={
                  <Link href={`/suppliers/${s.id}`} className="underline-offset-4 hover:underline">
                    {s.name}
                  </Link>
                }
                subtitle={s.code}
                badge={<ChipSac sac={s.is_active ? "emerald" : "slate"}>{s.is_active ? "Đang giao dịch" : "Ngừng"}</ChipSac>}
                stats={[
                  { label: "Điện thoại", value: s.phone ?? "-", strong: true },
                  { label: "Liên hệ", value: s.contact_name ?? "-" },
                  { label: "Ngày được nợ", value: s.payment_terms_days },
                ]}
              />
            ))}
          </MobileCardList>
          <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
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
                      <ChipSac sac={s.is_active ? "emerald" : "slate"}>{s.is_active ? "Đang giao dịch" : "Ngừng"}</ChipSac>
                    </TableCell>
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
