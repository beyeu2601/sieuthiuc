import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { AutoPrint, PrintButton } from "./auto-print";

export const metadata = { title: "Hóa đơn" };

const METHOD = { cash: "Tiền mặt", transfer: "Chuyển khoản", other: "Khác" } as const;

// Hoa don ban le kho 80mm (SPEC 13.2 cap co ban): in bang hop thoai in cua trinh duyet.
export default async function ReceiptPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ auto?: string }>;
}) {
  const { id } = await params;
  const { auto } = await searchParams;
  await requireSession();
  const supabase = await createClient();
  const { data: s } = await supabase
    .from("sales")
    .select("id, code, store_id, status, subtotal, discount_amount, total, completed_at, creator:created_by(full_name), stores(name, address, phone, invoice_header, invoice_footer)")
    .eq("id", id)
    .maybeSingle();
  if (!s) notFound();
  const [{ data: items }, { data: payments }] = await Promise.all([
    supabase.from("sale_items").select("id, product_id, qty, unit_price, discount_amount, line_total").eq("sale_id", id).order("line_no"),
    supabase.from("sale_payments").select("method, amount").eq("sale_id", id),
  ]);
  const ids = [...new Set((items ?? []).map((i) => i.product_id))];
  const { data: prods } = ids.length ? await supabase.rpc("catalog_by_ids", { p_ids: ids }) : { data: [] };
  const pmap = new Map(((prods ?? []) as { product_id: string; name: string }[]).map((p) => [p.product_id, p.name]));
  const store = s.stores as unknown as { name: string; address: string | null; phone: string | null; invoice_header: string | null; invoice_footer: string | null };

  return (
    <div className="receipt mx-auto bg-white p-3 font-mono text-[12px] leading-snug text-black">
      <style>{`
        @page { size: 80mm auto; margin: 0 }
        .receipt { width: 72mm }
        @media print { body { background: white } .no-print { display: none } }
      `}</style>
      {auto === "1" && <AutoPrint />}
      <div className="text-center">
        <div className="text-[14px] font-bold">{store.name}</div>
        {store.address && <div>{store.address}</div>}
        {store.phone && <div>ĐT: {store.phone}</div>}
        {store.invoice_header && <div className="whitespace-pre-line">{store.invoice_header}</div>}
        <div className="mt-1 font-bold">HÓA ĐƠN BÁN LẺ</div>
        <div>{s.code}</div>
        <div>{formatDateTime(s.completed_at)}</div>
        <div>NV: {(s.creator as unknown as { full_name: string } | null)?.full_name}</div>
        {s.status === "cancelled" && <div className="font-bold">ĐÃ HỦY</div>}
      </div>
      <hr className="my-1 border-dashed border-black" />
      {(items ?? []).map((i) => (
        <div key={i.id} className="mb-1">
          <div>{pmap.get(i.product_id)}</div>
          <div className="flex justify-between">
            <span>
              {formatNumber(i.qty)} x {new Intl.NumberFormat("vi-VN").format(i.unit_price)}
              {i.discount_amount ? ` (-${new Intl.NumberFormat("vi-VN").format(i.discount_amount)})` : ""}
            </span>
            <span>{new Intl.NumberFormat("vi-VN").format(i.line_total)}</span>
          </div>
        </div>
      ))}
      <hr className="my-1 border-dashed border-black" />
      <div className="flex justify-between">
        <span>Tiền hàng</span>
        <span>{formatMoney(s.subtotal)}</span>
      </div>
      {s.discount_amount > 0 && (
        <div className="flex justify-between">
          <span>Giảm giá</span>
          <span>-{formatMoney(s.discount_amount)}</span>
        </div>
      )}
      <div className="flex justify-between text-[14px] font-bold">
        <span>TỔNG</span>
        <span>{formatMoney(s.total)}</span>
      </div>
      {(payments ?? []).map((p, i) => (
        <div key={i} className="flex justify-between">
          <span>{METHOD[p.method as keyof typeof METHOD]}</span>
          <span>{formatMoney(p.amount)}</span>
        </div>
      ))}
      <hr className="my-1 border-dashed border-black" />
      <div className="text-center whitespace-pre-line">{store.invoice_footer ?? "Cảm ơn quý khách"}</div>
      <div className="no-print mt-4 text-center">
        <PrintButton />
      </div>
    </div>
  );
}
