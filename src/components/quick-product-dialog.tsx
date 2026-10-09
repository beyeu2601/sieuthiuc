"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { quickCreateProduct } from "@/app/(app)/[store]/receipts/actions";
import { MoneyInput } from "@/components/money-input";
import { LuaChon } from "@/components/lua-chon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type QuickProduct = {
  product_id: string;
  sku: string;
  name: string;
  unit: string;
  goods_type: "cont" | "air";
  expiry_level: "none" | "product" | "lot";
  sell_price: number;
};

// Tao nhanh san pham chua co trong danh muc (sadmin/admin theo RLS), dung o phieu nhap va don dat truoc
export function QuickProductDialog({
  open,
  onOpenChange,
  onCreated,
  initialName = "",
  submitLabel = "Tạo và thêm vào phiếu",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (p: QuickProduct) => void;
  initialName?: string;
  submitLabel?: string;
}) {
  const [name, setName] = useState(initialName);
  const [goodsType, setGoodsType] = useState<"cont" | "air">("air");
  const [unit, setUnit] = useState("");
  const [sellPrice, setSellPrice] = useState<number | null>(null);
  const [dateType, setDateType] = useState<"short" | "long">("long");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Mo tu o tim khong ra ket qua: dien san ten vua go
  useEffect(() => {
    if (open && initialName) setName(initialName);
  }, [open, initialName]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await quickCreateProduct({ name, goods_type: goodsType, unit, sell_price: sellPrice ?? 0, date_type: dateType });
      if (!res.ok) return setError(res.error);
      onCreated({ ...res.data!, sell_price: sellPrice ?? 0 });
      toast.success(`Đã thêm sản phẩm ${res.data!.sku}`);
      setName("");
      setUnit("");
      setSellPrice(null);
      setDateType("long");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex min-h-0 flex-col gap-3">
          <DialogHeader>
            <DialogTitle>Thêm sản phẩm mới</DialogTitle>
            <DialogDescription>Sản phẩm chưa có trong danh mục. SKU tự sinh.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            {error && (
              <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="qp-name">Tên sản phẩm *</Label>
              <Input id="qp-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="qp-type">Loại hàng</Label>
                <LuaChon
                  id="qp-type"
                  aria-label="Loại hàng"
                  value={goodsType}
                  onChange={(v) => setGoodsType(v as "cont" | "air")}
                  options={[
                    { value: "air", label: "Air" },
                    { value: "cont", label: "Cont" },
                  ]}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="qp-unit">Đơn vị tính *</Label>
                <Input id="qp-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Hộp, Lon, Cái..." />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qp-price">Giá bán</Label>
              <MoneyInput id="qp-price" value={sellPrice} onChange={setSellPrice} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qp-date" title="Date dài giảm giá khi tới ngưỡng dài, date ngắn giảm giá khi tới ngưỡng ngắn">
                Loại date (cận date)
              </Label>
              <LuaChon
                id="qp-date"
                aria-label="Loại date"
                value={dateType}
                onChange={(v) => setDateType(v as "short" | "long")}
                options={[
                  { value: "long", label: "Date dài" },
                  { value: "short", label: "Date ngắn" },
                ]}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={pending || !name.trim() || !unit.trim()}>
              {pending ? "Đang tạo..." : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
