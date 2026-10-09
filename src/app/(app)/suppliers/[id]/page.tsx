import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";
import { formatDateVN, todayVN } from "@/lib/dates";
import { PageHeader } from "@/components/page-header";
import { ChipSac } from "@/components/ui/chip";
import { ChiSo, HangChiSo } from "@/components/ui/chi-so";
import { Khoi } from "@/components/khoi";
import { SupplierForm } from "../supplier-form";
import { DeleteOpeningDebt, OpeningDebtButton } from "./opening-debt";

export default async function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireRole("sadmin", "admin", "accountant");
  const supabase = await createClient();
  const [{ data: s }, { data: debts }] = await Promise.all([
    supabase
      .from("suppliers")
      .select(
        "id, code, name, contact_name, phone, email, address, tax_code, bank_name, bank_account, payment_terms_days, note, is_active"
      )
      .eq("id", id)
      .maybeSingle(),
    // Chi doc de hien so: khoan no con lai cua NCC o cac cua hang nguoi dung xem duoc
    supabase
      .from("supplier_debts")
      .select("id, code, due_date, remaining, paid_amount, store_id, receipt_id, note")
      .eq("supplier_id", id)
      .in(
        "store_id",
        ctx.stores.map((st) => st.id)
      )
      .gt("remaining", 0)
      .order("due_date", { ascending: true, nullsFirst: false }),
  ]);
  if (!s) notFound();
  const { id: supplierId, code, ...initial } = s;

  const today = todayVN();
  const openDebts = (debts ?? []).map((d) => ({ ...d, overdue: !!d.due_date && String(d.due_date) < today }));
  const remaining = openDebts.reduce((t, d) => t + Number(d.remaining), 0);
  const overdue = openDebts.filter((d) => d.overdue).reduce((t, d) => t + Number(d.remaining), 0);
  const overdueCount = openDebts.filter((d) => d.overdue).length;
  const storeCode = (sid: string) => ctx.stores.find((st) => st.id === sid)?.code;
  const multiStore = ctx.stores.length > 1;

  return (
    <div className="space-y-4">
      <PageHeader
        title={s.name}
        description={
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <ChipSac sac="slate" className="font-mono">{code}</ChipSac>
            <ChipSac sac={s.is_active ? "emerald" : "slate"}>{s.is_active ? "Đang giao dịch" : "Ngừng giao dịch"}</ChipSac>
            {!s.phone && <ChipSac sac="amber">Chưa có điện thoại</ChipSac>}
          </span>
        }
      />

      <HangChiSo className="lg:grid-cols-3">
        <ChiSo
          nhan={remaining > 0 ? "Còn nợ" : "Không còn nợ"}
          sac={remaining > 0 ? "amber" : "emerald"}
          giaTri={formatMoney(remaining)}
          phu={`${openDebts.length} khoản chưa trả hết`}
        />
        <ChiSo
          nhan={overdue > 0 ? "Nợ quá hạn" : "Không có nợ quá hạn"}
          sac={overdue > 0 ? "red" : "emerald"}
          giaTri={formatMoney(overdue)}
          phu={overdueCount > 0 ? `${overdueCount} khoản quá hạn` : undefined}
        />
        <ChiSo nhan="Ngày được nợ" sac="brand" giaTri={s.payment_terms_days} phu={s.payment_terms_days === 0 ? "Trả ngay" : undefined} />
      </HangChiSo>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <Khoi title="Thông tin nhà cung cấp" className="min-w-0">
          <SupplierForm id={supplierId} readOnly={false} initial={initial} />
        </Khoi>

        <Khoi
          title="Khoản nợ đang mở"
          className="min-w-0"
          aside={
            <span className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground tabular-nums">{openDebts.length}</span>
              {ctx.stores.length > 0 && <OpeningDebtButton supplierId={supplierId} termsDays={s.payment_terms_days} stores={ctx.stores} today={today} />}
            </span>
          }
        >
          {openDebts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Không còn khoản nợ nào.</p>
          ) : (
            <ul className="divide-y text-sm">
              {openDebts.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <Link
                      href={`/${storeCode(d.store_id)}/payables?tab=all&supplier=${supplierId}`}
                      className="font-mono text-xs font-medium hover:underline"
                    >
                      {d.code}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      {d.overdue ? (
                        <ChipSac sac="red" dam>
                          Quá hạn {formatDateVN(String(d.due_date))}
                        </ChipSac>
                      ) : (
                        <span className="text-xs text-muted-foreground">{d.due_date ? `Hạn ${formatDateVN(String(d.due_date))}` : "Chưa có hạn"}</span>
                      )}
                      {multiStore && <ChipSac sac="slate">{storeCode(d.store_id)}</ChipSac>}
                      {!d.receipt_id && <span className="text-xs text-muted-foreground">{d.note ?? "Nợ ghi tay"}</span>}
                    </div>
                  </div>
                  <span className="flex shrink-0 items-center gap-1">
                    <span className="font-medium tabular-nums">{formatMoney(d.remaining)}</span>
                    {!d.receipt_id && Number(d.paid_amount) === 0 && <DeleteOpeningDebt supplierId={supplierId} debtId={d.id} code={d.code} />}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Khoi>
      </div>
    </div>
  );
}
