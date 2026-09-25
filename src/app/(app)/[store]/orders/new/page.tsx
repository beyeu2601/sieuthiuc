import { requireStore } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { OrderForm } from "./order-form";

export const metadata = { title: "Tạo đơn online" };

export default async function NewOrderPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: code } = await params;
  const { store } = await requireStore(code, "sadmin", "admin", "staff");
  return (
    <div className="max-w-4xl">
      <PageHeader title="Tạo đơn online" description="Hàng trong đơn được giữ lại cho tới khi giao xong hoặc hủy đơn." />
      <OrderForm storeId={store.id} storeCode={store.code} />
    </div>
  );
}
