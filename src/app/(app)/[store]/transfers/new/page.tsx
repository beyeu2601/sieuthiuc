import { requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { TransferEditor } from "./transfer-editor";

export const metadata = { title: "Tạo phiếu chuyển" };

export default async function NewTransferPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: code } = await params;
  const { store } = await requireStore(code, "sadmin", "admin", "staff");
  const supabase = await createClient();
  // cua hang nhan: moi cua hang dang hoat dong khac cua hang gui (ham RPC kiem tra lai)
  const { data: targets } = await supabase.rpc("active_store_options");
  const others = ((targets ?? []) as { id: string; code: string; name: string }[]).filter((s) => s.id !== store.id);

  return (
    <div className="max-w-4xl">
      <PageHeader title="Tạo phiếu chuyển" description={`Gửi từ ${store.name}`} />
      {others.length === 0 ? (
        <EmptyState title="Chưa có cửa hàng khác để chuyển hàng">
          Hệ thống đang có một cửa hàng. Chức năng này dùng khi mở thêm cửa hàng.
        </EmptyState>
      ) : (
        <TransferEditor storeId={store.id} storeCode={store.code} targets={others} />
      )}
    </div>
  );
}
