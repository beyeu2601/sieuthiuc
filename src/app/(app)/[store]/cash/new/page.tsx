import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayVN } from "@/lib/dates";
import { PageHeader } from "@/components/page-header";
import { CashForm } from "./cash-form";

export const metadata = { title: "Ghi thu chi" };

export default async function NewCashPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: code } = await params;
  const { ctx, store } = await requireStore(code);
  const supabase = await createClient();
  const [{ data: cats }, { data: shift }] = await Promise.all([
    supabase.from("expense_categories").select("id, name, kind").eq("is_active", true).order("name"),
    supabase.from("shifts").select("id, code").eq("store_id", store.id).eq("user_id", ctx.profile.id).eq("status", "open").maybeSingle(),
  ]);
  const isStaff = ctx.profile.role === "staff";

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Ghi thu chi"
        description={isStaff ? "Nhân viên ghi được khoản chi tiền mặt lấy từ két trong ca đang mở." : "Khoản thu chi ngoài bán hàng và nhập hàng."}
      />
      {isStaff && !shift ? (
        <p className="rounded-xl border bg-card p-4 text-sm">Bạn cần mở ca trước khi ghi khoản chi tiền mặt.</p>
      ) : (
        <CashForm
          storeId={store.id}
          storeCode={store.code}
          categories={(cats ?? []) as { id: string; name: string; kind: "income" | "expense" }[]}
          isStaff={isStaff}
          openShiftCode={shift?.code ?? null}
          today={todayVN()}
        />
      )}
    </div>
  );
}
