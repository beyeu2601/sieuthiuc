import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSetting } from "@/lib/settings";
import { LabelSheet, type LabelItem } from "./label-sheet";

export const metadata = { title: "In tem" };

export default async function LabelsPage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  await requireRole("sadmin", "admin");
  const { ids } = await searchParams;
  const idList = (ids ?? "").split(",").filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 200);
  const supabase = await createClient();
  const [{ data }, size] = await Promise.all([
    idList.length
      ? supabase.from("products").select("id, sku, name, sell_price, product_barcodes(barcode, is_primary)").in("id", idList)
      : Promise.resolve({ data: [] as never[] }),
    getSetting<string>("label.size", "40x30"),
  ]);

  const items: LabelItem[] = (data ?? []).map((p) => {
    const bcs = (p.product_barcodes ?? []) as { barcode: string; is_primary: boolean }[];
    const primary = bcs.find((b) => b.is_primary) ?? bcs[0];
    return { id: p.id, name: p.name, price: p.sell_price, barcode: primary?.barcode ?? p.sku };
  });
  const [w, h] = String(size).split("x").map(Number);

  return <LabelSheet items={items} widthMm={w || 40} heightMm={h || 30} />;
}
