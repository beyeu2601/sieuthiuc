"use server";

import { createClient } from "@/lib/supabase/server";
import { errorMessage, type ActionResult } from "@/lib/errors";

export type CatalogItem = {
  product_id: string;
  sku: string;
  name: string;
  unit: string;
  goods_type: "cont" | "air";
  sell_price: number;
  status: "active" | "inactive";
  expiry_level: "none" | "product" | "lot";
  barcode: string | null;
  pack_qty: number;
  barcodes: string[];
  qty_on_hand: number;
  qty_reserved: number;
  qty_available: number;
  nearest_expiry: string | null;
};

export async function searchCatalog(storeId: string, q: string, limit = 20): Promise<ActionResult<CatalogItem[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("catalog_search", { p_store_id: storeId, p_q: q, p_limit: limit });
  if (error) return { ok: false, error: errorMessage(error) };
  return {
    ok: true,
    data: ((data ?? []) as CatalogItem[]).map((r) => ({
      ...r,
      pack_qty: Number(r.pack_qty),
      qty_on_hand: Number(r.qty_on_hand),
      qty_reserved: Number(r.qty_reserved),
      qty_available: Number(r.qty_available),
    })),
  };
}

export type LotRow = {
  lot_id: string;
  product_id: string;
  sku: string;
  name: string;
  unit: string;
  goods_type: "cont" | "air";
  lot_no: string;
  expiry_date: string | null;
  qty_on_hand: number;
  days_left: number | null;
  expiry_status: "none" | "normal" | "near" | "expired";
  unit_cost: number | null;
};

export async function productLots(storeId: string, productId: string): Promise<ActionResult<LotRow[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lot_expiry", { p_store_id: storeId, p_product_id: productId });
  if (error) return { ok: false, error: errorMessage(error) };
  return { ok: true, data: ((data ?? []) as LotRow[]).map((r) => ({ ...r, qty_on_hand: Number(r.qty_on_hand) })) };
}
