import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { ImportForm } from "./import-form";

export const metadata = { title: "Import sản phẩm" };

export default async function ImportPage() {
  await requireRole("sadmin", "admin");
  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Import sản phẩm từ Excel"
        description="Tạo nhiều sản phẩm một lần. Không nhập tồn kho ở đây: tồn đi vào hệ thống qua phiếu nhập hàng."
      />
      <ImportForm />
    </div>
  );
}
