"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TrashIcon } from "lucide-react";
import { createTransfer } from "../actions";
import { productLots, type CatalogItem, type LotRow } from "../../catalog-actions";
import { formatNumber } from "@/lib/format";
import { ProductPicker } from "@/components/product-picker";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Line = { lot: LotRow; qty: number };

export function TransferEditor({
  storeId,
  storeCode,
  targets,
}: {
  storeId: string;
  storeCode: string;
  targets: { id: string; code: string; name: string }[];
}) {
  const router = useRouter();
  const [to, setTo] = useState(targets.length === 1 ? targets[0].id : "");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [choices, setChoices] = useState<LotRow[] | null>(null);
  const [pending, start] = useTransition();

  function pick(it: CatalogItem) {
    start(async () => {
      const res = await productLots(storeId, it.product_id);
      const lots = (res.ok ? (res.data ?? []) : []).filter((l) => l.expiry_status !== "expired");
      if (lots.length === 0) return void toast.error(`${it.name}: không còn lô nào để chuyển`);
      if (lots.length === 1) addLot(lots[0]);
      else setChoices(lots);
    });
  }

  function addLot(l: LotRow) {
    setChoices(null);
    setLines((ls) => (ls.some((x) => x.lot.lot_id === l.lot_id) ? ls : [...ls, { lot: l, qty: 1 }]));
  }

  function submit(send: boolean) {
    start(async () => {
      const res = await createTransfer(
        storeCode,
        { from_store_id: storeId, to_store_id: to, note: note || null, items: lines.map((l) => ({ lot_id: l.lot.lot_id, qty: l.qty })) },
        send
      );
      if (!res.ok) return void toast.error(res.error);
      toast.success(send ? "Đã gửi hàng" : "Đã lưu nháp");
      router.push(`/${storeCode}/transfers/${res.data!.id}`);
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-xl border bg-background p-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="to">Cửa hàng nhận *</Label>
          <NativeSelect id="to" value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">Chọn cửa hàng</option>
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code} - {t.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="note">Ghi chú</Label>
          <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      <div className="space-y-3 rounded-xl border bg-background p-4">
        <ProductPicker storeId={storeId} onPick={pick} />
        {choices && (
          <div className="rounded-lg border p-2">
            <p className="mb-1 text-sm font-medium">Chọn lô</p>
            {choices.map((l) => (
              <button
                key={l.lot_id}
                type="button"
                onClick={() => addLot(l)}
                className="flex w-full justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
              >
                <span>
                  {l.name} - lô {l.lot_no}
                </span>
                <span className="text-muted-foreground">
                  HSD {l.expiry_date ? new Date(l.expiry_date).toLocaleDateString("vi-VN") : "-"} - còn {formatNumber(l.qty_on_hand)}
                </span>
              </button>
            ))}
          </div>
        )}
        {lines.map((l) => (
          <div key={l.lot.lot_id} className="flex flex-wrap items-center gap-2 border-t pt-2">
            <div className="min-w-48 flex-1 text-sm">
              {l.lot.name}
              <div className="text-xs text-muted-foreground">
                Lô {l.lot.lot_no} - còn {formatNumber(l.lot.qty_on_hand)} {l.lot.unit}
              </div>
            </div>
            <Input
              type="number"
              aria-label="Số lượng chuyển"
              min={0}
              max={l.lot.qty_on_hand}
              value={l.qty}
              onChange={(e) =>
                setLines((ls) => ls.map((x) => (x.lot.lot_id === l.lot.lot_id ? { ...x, qty: Number(e.target.value) } : x)))
              }
              className="w-28"
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Xóa dòng"
              onClick={() => setLines((ls) => ls.filter((x) => x.lot.lot_id !== l.lot.lot_id))}
            >
              <TrashIcon />
            </Button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="h-10" disabled={pending || !to || lines.length === 0} onClick={() => submit(false)}>
          Lưu nháp
        </Button>
        <Button className="h-10" disabled={pending || !to || lines.length === 0} onClick={() => submit(true)}>
          Gửi hàng
        </Button>
      </div>
    </div>
  );
}
