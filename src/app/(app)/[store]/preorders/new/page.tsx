import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayVN } from "@/lib/dates";
import { PageHeader } from "@/components/page-header";
import { PreorderForm } from "./preorder-form";
import type { MoneyAccount } from "../labels";

export const metadata = { title: "Tạo đơn đặt trước" };

export default async function NewPreorderPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: code } = await params;
  const { ctx, store } = await requireStore(code, "sadmin", "admin", "staff");
  const supabase = await createClient();
  const { data: accounts } = await supabase.from("money_accounts").select("id, name, kind").eq("is_active", true).order("sort_order").order("name");
  return (
    <div className="max-w-4xl">
      <PageHeader title="Tạo đơn đặt trước" back={{ href: `/${store.code}/preorders`, label: "Đặt trước" }} />
      <PreorderForm
        storeId={store.id}
        storeCode={store.code}
        accounts={(accounts ?? []) as MoneyAccount[]}
        today={todayVN()}
        showCost={ctx.profile.role !== "staff"}
        canCreateProduct={ctx.profile.role === "sadmin" || ctx.profile.role === "admin"}
      />
    </div>
  );
}
