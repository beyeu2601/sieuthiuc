import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getNumberSetting } from "@/lib/settings";
import { PageHeader } from "@/components/page-header";
import { OpenShiftForm } from "../shifts/shift-forms";
import { PosClient } from "./pos-client";

export const metadata = { title: "Bán hàng" };

export default async function PosPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: code } = await params;
  const { ctx, store } = await requireStore(code, "sadmin", "admin", "staff");
  const supabase = await createClient();
  const [{ data: shift }, maxPct] = await Promise.all([
    supabase
      .from("shifts")
      .select("id, code")
      .eq("store_id", store.id)
      .eq("user_id", ctx.profile.id)
      .eq("status", "open")
      .maybeSingle(),
    getNumberSetting("pos.max_manual_discount_pct", 10, store.id),
  ]);

  if (!shift) {
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-xl border bg-background p-6">
        <PageHeader title="Chưa mở ca" description="Mở ca và đếm tiền mặt đầu ca trước khi bán hàng." />
        <OpenShiftForm storeCode={store.code} storeId={store.id} />
      </div>
    );
  }

  return (
    <PosClient
      storeId={store.id}
      storeCode={store.code}
      shiftId={shift.id}
      shiftCode={shift.code}
      maxDiscountPct={ctx.profile.role === "staff" ? maxPct : null}
    />
  );
}
