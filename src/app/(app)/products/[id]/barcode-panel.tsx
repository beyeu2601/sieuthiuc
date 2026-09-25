"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addBarcode, deleteBarcode, generateInternalBarcode, setPrimaryBarcode } from "../actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
      {barcodes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Chưa có mã vạch. Quét mã in trên bao bì, hoặc sinh mã nội bộ nếu hàng không có mã.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {barcodes.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <span className="font-mono tabular-nums">{b.barcode}</span>
              {b.is_primary && <Badge>Mã chính</Badge>}
              <Badge variant="outline">{b.type === "internal" ? "Nội bộ" : "Nhà sản xuất"}</Badge>
              {Number(b.pack_qty) > 1 && <Badge variant="secondary">Lốc {Number(b.pack_qty)} đơn vị</Badge>}
              {canEdit && (
                <span className="ml-auto flex gap-1">
                  {!b.is_primary && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => run(() => setPrimaryBarcode(productId, b.id), "Đã đặt mã chính")}
                    >
                      Đặt làm mã chính
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    disabled={pending}
                    onClick={() => {
                      if (confirm(`Xóa mã ${b.barcode}?`)) run(() => deleteBarcode(productId, b.id), "Đã xóa mã vạch");
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
        <form onSubmit={add} className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="new-barcode">Thêm mã vạch</Label>
            <Input
              id="new-barcode"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Quét hoặc nhập mã"
              className="w-56"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pack-qty">Số đơn vị / mã</Label>
            <Input
              id="pack-qty"
              type="number"
              min={1}
              value={pack}
              onChange={(e) => setPack(e.target.value)}
              className="w-28"
            />
          </div>
          <Button type="submit" disabled={pending || !code.trim()}>
            Gán mã
          </Button>
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
        </form>
      )}
    </div>
  );
}
