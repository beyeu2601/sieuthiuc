import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { SuggestionTable, type Suggestion } from "./suggestion-table";

export const metadata = { title: "Gợi ý giá" };

export default async function PriceSuggestionsPage() {
  await requireRole("sadmin", "admin");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("price_suggestions");
  const rows = (data ?? []) as Suggestion[];

  return (
    <div>
      <PageHeader
        title="Gợi ý giá"
        description="Sản phẩm đặt giá theo % Benefit có giá vốn thay đổi sau nhập hàng. Giá chỉ đổi khi bạn xác nhận."
      />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          Không tải được danh sách gợi ý.
        </p>
      ) : rows.length === 0 ? (
        <EmptyState title="Không có gợi ý giá nào">Giá bán đang khớp với giá vốn và % Benefit.</EmptyState>
      ) : (
        <SuggestionTable rows={rows} />
      )}
    </div>
  );
}
