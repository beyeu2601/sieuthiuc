import { hasPerm, requireStore } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { ReceiptEditor, type EditorLine } from "../receipt-editor";

export const metadata = { title: "Phiếu nhập mới" };

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
}

// ?products=<id>:<so luong>,... de dien san tu danh sach ton thap
export default async function NewReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ store: string }>;
  searchParams: Promise<{ products?: string }>;
}) {
  const { store: code } = await params;
  const { products } = await searchParams;
  const { ctx, store } = await requireStore(code, "sadmin", "admin", "staff");
  const supabase = await createClient();
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, code, name, payment_terms_days")
    .eq("is_active", true)
    .order("name");

  const wanted = new Map(
    (products ?? "")
      .split(",")
      .map((x) => x.split(":"))
      .filter(([id]) => /^[0-9a-f-]{36}$/i.test(id ?? ""))
      .map(([id, q]) => [id, Math.max(1, Number(q) || 1)])
  );
  let lines: EditorLine[] = [];
  if (wanted.size) {
    const { data } = await supabase.rpc("catalog_by_ids", { p_ids: [...wanted.keys()] });
    lines = ((data ?? []) as Omit<EditorLine, "key" | "qty" | "unit_cost" | "lot_no" | "expiry_date">[]).map((p) => ({
      ...p,
      key: p.product_id,
      qty: wanted.get(p.product_id) ?? 1,
      unit_cost: null,
      lot_no: "",
      expiry_date: "",
    }));
  }

  return (
    <div>
      <PageHeader title="Phiếu nhập mới" description={`${store.name}. Phiếu nháp chưa làm thay đổi tồn kho.`} />
      <ReceiptEditor
        storeId={store.id}
        storeCode={store.code}
        receiptId={null}
        suppliers={suppliers ?? []}
        canConfirm={ctx.profile.role !== "staff" || hasPerm(ctx, "confirm_receipt")}
        initial={{ supplier_id: "", receipt_date: today(), invoice_no: "", due_date: "", note: "", lines, costs: [] }}
      />
    </div>
  );
}
