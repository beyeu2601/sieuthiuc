import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ChipSac } from "@/components/ui/chip";
import { ChiSo, HangChiSo } from "@/components/ui/chi-so";
import { formatNumber } from "@/lib/format";
import { SuggestionTable, type Suggestion } from "./suggestion-table";

export const metadata = { title: "Gợi ý giá" };

export default async function PriceSuggestionsPage() {
  await requireRole("sadmin", "admin");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("price_suggestions");
  const rows = (data ?? []) as Suggestion[];
  const up = rows.filter((r) => r.suggested_price > r.current_price).length;

  return (
    <div>
      <PageHeader
        title="Gợi ý giá"
        description={
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5" title="Sản phẩm đặt giá theo % Benefit có giá vốn thay đổi sau nhập hàng">
            <ChipSac sac="slate">Theo % Benefit</ChipSac>
            <ChipSac sac="slate">Giá chỉ đổi khi bạn xác nhận</ChipSac>
          </span>
        }
      />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          Không tải được danh sách gợi ý.
        </p>
      ) : rows.length === 0 ? (
        <EmptyState title="Không có gợi ý giá nào">Giá bán đang khớp với giá vốn và % Benefit.</EmptyState>
      ) : (
        <div className="space-y-3">
          <HangChiSo>
            <ChiSo nhan="Gợi ý" sac="brand" giaTri={formatNumber(rows.length)} />
            <ChiSo nhan="Tăng giá" sac={up > 0 ? "emerald" : "slate"} giaTri={formatNumber(up)} />
            <ChiSo nhan="Giảm giá" sac={rows.length - up > 0 ? "red" : "slate"} giaTri={formatNumber(rows.length - up)} />
          </HangChiSo>
          <SuggestionTable rows={rows} />
        </div>
      )}
    </div>
  );
}
