import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayVN } from "@/lib/dates";
import { PageHeader } from "@/components/page-header";
import { PayoutForm, type UnpaidOrder } from "./payout-form";

export const metadata = { title: "Ghi đợt tiền Shopee" };

export default async function NewPayoutPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: code } = await params;
  const { store } = await requireStore(code, "sadmin", "admin", "accountant");
  const supabase = await createClient();
  const [{ data }, { data: accounts }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, code, external_order_id, customer_name, subtotal, discount_amount, platform_fee, sales!orders_sale_id_fkey(completed_at)")
      .eq("store_id", store.id)
      .eq("channel", "shopee")
      .eq("status", "delivered")
      .is("payout_id", null)
      .order("created_at"),
    supabase.from("money_accounts").select("id, name, kind").eq("is_active", true).order("sort_order").order("name"),
  ]);
  const orders: UnpaidOrder[] = (data ?? []).map((o) => ({
    id: o.id,
    code: o.code,
    external_order_id: o.external_order_id,
    customer_name: o.customer_name,
    amount: o.subtotal - o.discount_amount,
    expected: o.subtotal - o.discount_amount - o.platform_fee,
    delivered_at: (o.sales as unknown as { completed_at: string } | null)?.completed_at ?? null,
  }));

  return (
    <div>
      <PageHeader
        title="Ghi đợt tiền Shopee về"
        back={{ href: `/${store.code}/orders/payouts`, label: "Đối soát Shopee" }}
      />
      <PayoutForm
        storeId={store.id}
        storeCode={store.code}
        orders={orders}
        accounts={(accounts ?? []) as { id: string; name: string; kind: string }[]}
        today={todayVN()}
      />
    </div>
  );
}
