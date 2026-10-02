import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { ChipSac } from "@/components/ui/chip";
import { ImportForm } from "./import-form";

export const metadata = { title: "Import sản phẩm" };

export default async function ImportPage() {
  await requireRole("sadmin", "admin");
  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Import sản phẩm từ Excel"
        description={
          <ChipSac sac="amber" className="mt-1.5" title="Tồn đi vào hệ thống qua phiếu nhập hàng">
            Không nhập tồn kho ở đây
          </ChipSac>
        }
      />
      <ImportForm />
    </div>
  );
}
