"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addBarcode, deleteBarcode, generateInternalBarcode, setPrimaryBarcode } from "../actions";
import { ChipSac } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Barcode = { id: string; barcode: string; type: "ean" | "internal"; pack_qty: number; is_primary: boolean };

export function BarcodePanel({
  productId,
  barcodes,
  canEdit,
}: {
  productId: string;
  barcodes: Barcode[];
  canEdit: boolean;
}) {
  const [code, setCode] = useState("");
  const [pack, setPack] = useState("1");
  const [pending, start] = useTransition();
  const { confirm, dialog } = useConfirm();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    start(async () => {
      const res = await fn();
      if (res.ok) toast.success(success);
      else toast.error(res.error);
    });
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim();
    if (!c) return;
    run(async () => {
      const res = await addBarcode(productId, c, Number(pack) || 1, false);
      if (res.ok) {
        setCode("");
        setPack("1");
      }
      return res;
    }, "Đã gán mã vạch");
  }

  return (
    <div className="space-y-3">
      {dialog}
      {barcodes.length === 0 ? (
        <p className="rounded-lg border border-vien-amber bg-nen-amber px-3 py-2 text-sm text-chu-amber">
          Chưa có mã vạch nên chưa quét được ở quầy. Quét mã trên bao bì vào ô dưới, hoặc sinh mã nội bộ nếu hàng không
          có mã.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {barcodes.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-1.5 px-3 py-2">
              <span className="mr-1 font-mono tabular-nums">{b.barcode}</span>
              {b.is_primary && (
                <ChipSac sac="brand" title="Mã in lên tem và hiển thị khi tra cứu">
                  Mã chính
                </ChipSac>
              )}
              <ChipSac
                sac={b.type === "internal" ? "purple" : "slate"}
                title={b.type === "internal" ? "Mã do hệ thống sinh (EAN-13)" : "Mã in sẵn trên bao bì"}
              >
                {b.type === "internal" ? "Nội bộ" : "Nhà sản xuất"}
              </ChipSac>
              {Number(b.pack_qty) > 1 && (
                <ChipSac sac="amber" title="Quét mã này ở quầy sẽ thêm nguyên lốc vào giỏ">
                  Lốc {Number(b.pack_qty)}
                </ChipSac>
              )}
              {canEdit && (
                <span className="ml-auto flex gap-1">
                  {!b.is_primary && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      title="Đặt mã này làm mã in lên tem"
                      onClick={() => run(() => setPrimaryBarcode(productId, b.id), "Đã đặt mã chính")}
                    >
                      Đặt chính
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    disabled={pending}
                    onClick={async () => {
                      if (await confirm({ title: `Xóa mã ${b.barcode}?`, danger: true }))
                        run(() => deleteBarcode(productId, b.id), "Đã xóa mã vạch");
                    }}
                  >
                    Xóa
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <div className="space-y-2">
          <form onSubmit={add} className="flex items-end gap-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="new-barcode">Thêm mã trên bao bì</Label>
              <Input
                id="new-barcode"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Quét hoặc nhập mã"
                autoComplete="off"
              />
            </div>
            <div className="w-20 space-y-1.5">
              <Label htmlFor="pack-qty">SL/mã</Label>
              <Input id="pack-qty" type="number" min={1} value={pack} onChange={(e) => setPack(e.target.value)} />
            </div>
            <Button type="submit" disabled={pending || !code.trim()}>
              Gán
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">SL/mã: 1 với hàng lẻ, mã thùng/lốc thì nhập số sản phẩm trong lốc.</p>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const res = await generateInternalBarcode(productId);
                  return res;
                }, "Đã sinh mã nội bộ")
              }
            >
              Sinh mã nội bộ
            </Button>
            <p className="text-xs text-muted-foreground">Khi hàng không có mã in sẵn (tạo mã EAN-13).</p>
          </div>
        </div>
      )}
    </div>
  );
}
