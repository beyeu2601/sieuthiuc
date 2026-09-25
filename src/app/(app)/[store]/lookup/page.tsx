import { requireStore } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { LookupClient } from "./lookup-client";

export const metadata = { title: "Tra cứu sản phẩm" };

export default async function LookupPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: code } = await params;
  const { store } = await requireStore(code);
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Tra cứu sản phẩm" description="Quét mã hoặc gõ tên để xem giá, tồn và hạn sử dụng." />
      <LookupClient storeId={store.id} />
    </div>
  );
}
