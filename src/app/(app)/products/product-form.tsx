"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";
import { quickCreateBrand, saveProduct } from "./actions";
import type { ProductInput } from "@/lib/schemas/product";
import { formatMoney } from "@/lib/format";
import { MoneyInput } from "@/components/money-input";
import { NativeSelect } from "@/components/native-select";
import { CategoryInfo } from "@/components/category-info";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Option = { id: string; name: string; benefit_pct?: number | null; description?: string | null };

export function ProductForm({
  id,
  initial,
  costPriceRef,
  categories,
  brands,
  readOnly,
  roundingUnit,
}: {
  id: string | null;
  initial: ProductInput;
  costPriceRef: number;
  categories: Option[];
  brands: Option[];
  readOnly: boolean;
  roundingUnit: number;
}) {
  const router = useRouter();
  const [v, setV] = useState<ProductInput>(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [brandList, setBrandList] = useState(brands);
  const [brandOpen, setBrandOpen] = useState(false);
  const set = <K extends keyof ProductInput>(k: K, val: ProductInput[K]) => setV((s) => ({ ...s, [k]: val }));
  // Sau khi luu, router.refresh() dua gia tri moi vao initial nen het "chua luu"
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);

  const catPct = categories.find((c) => c.id === v.category_id)?.benefit_pct ?? null;
  const pct = v.benefit_pct ?? catPct;
  const cost = id ? costPriceRef : (v.cost_price_ref ?? 0);
  const preview =
    v.pricing_method === "benefit" && pct != null && cost > 0
      ? Math.round((cost * (1 + pct / 100)) / roundingUnit) * roundingUnit
      : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await saveProduct(id, v);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(id ? "Đã lưu sản phẩm" : "Đã tạo sản phẩm");
      if (!id && res.data) router.push(`/products/${res.data.id}`);
      else router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="@container space-y-4">
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <fieldset disabled={readOnly || pending} className="grid gap-x-4 gap-y-3 @md:grid-cols-2 @3xl:grid-cols-4">
        <div className="space-y-1.5 @md:col-span-2">
          <Label htmlFor="name">Tên sản phẩm *</Label>
          <Input id="name" value={v.name} onChange={(e) => set("name", e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="goods_type">Loại hàng *</Label>
          <NativeSelect id="goods_type" value={v.goods_type} onChange={(e) => set("goods_type", e.target.value as "cont" | "air")}>
            <option value="cont">Cont</option>
            <option value="air">Air</option>
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="unit">Đơn vị tính *</Label>
          <Input id="unit" value={v.unit} onChange={(e) => set("unit", e.target.value)} placeholder="Hộp, Lon, Chai..." required />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-1">
            <Label htmlFor="category">Nhóm hàng</Label>
            <CategoryInfo categories={categories} />
          </div>
          <NativeSelect id="category" value={v.category_id ?? ""} onChange={(e) => set("category_id", e.target.value || null)}>
            <option value="">Chưa phân nhóm</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.benefit_pct != null ? ` (${c.benefit_pct}%)` : ""}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="brand">Thương hiệu</Label>
          <div className="flex gap-2">
            <NativeSelect id="brand" value={v.brand_id ?? ""} onChange={(e) => set("brand_id", e.target.value || null)}>
              <option value="">Không có</option>
              {brandList.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </NativeSelect>
            {!readOnly && (
              <Button type="button" variant="outline" className="shrink-0" onClick={() => setBrandOpen(true)}>
                <PlusIcon /> Thêm
              </Button>
            )}
          </div>
        </div>

        {!id && (
          <div className="space-y-1.5">
            <Label htmlFor="cost_price_ref">Giá vốn (₫)</Label>
            <MoneyInput id="cost_price_ref" value={v.cost_price_ref ?? 0} onChange={(n) => set("cost_price_ref", n ?? 0)} />
            <p className="text-xs text-muted-foreground">Không bắt buộc, có thể nhập sau ở trang sản phẩm. Khi nhập hàng, giá vốn tự cập nhật theo bình quân.</p>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="pricing_method">Cách đặt giá</Label>
          <NativeSelect
            id="pricing_method"
            value={v.pricing_method}
            onChange={(e) => set("pricing_method", e.target.value as "manual" | "benefit")}
          >
            <option value="manual">Nhập giá trực tiếp</option>
            <option value="benefit">Theo % Benefit trên giá vốn</option>
          </NativeSelect>
        </div>
        {v.pricing_method === "manual" ? (
          <div className="space-y-1.5">
            <Label htmlFor="sell_price">Giá bán (₫) *</Label>
            <MoneyInput id="sell_price" value={v.sell_price} onChange={(n) => set("sell_price", n ?? 0)} className="font-semibold" />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="benefit_pct">% Benefit</Label>
            <Input
              id="benefit_pct"
              type="number"
              inputMode="decimal"
              min={0}
              max={1000}
              step="0.01"
              value={v.benefit_pct ?? ""}
              placeholder={catPct != null ? `Theo nhóm hàng: ${catPct}%` : "Nhập %"}
              onChange={(e) => set("benefit_pct", e.target.value === "" ? null : Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Giá vốn tham chiếu {formatMoney(cost)}.{" "}
              {preview != null
                ? `Giá bán sẽ là ${formatMoney(preview)} (làm tròn ${formatMoney(roundingUnit)}).`
                : "Chưa có giá vốn hoặc %, giá bán giữ nguyên cho tới khi nhập hàng."}
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="date_type">Loại date (cận date)</Label>
          <NativeSelect
            id="date_type"
            value={v.date_type}
            onChange={(e) => set("date_type", e.target.value as "short" | "long")}
          >
            <option value="long">Date dài</option>
            <option value="short">Date ngắn</option>
          </NativeSelect>
          <p className="text-xs text-muted-foreground">Ngưỡng gợi ý giảm giá ở màn Hạn sử dụng.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="expiry_level">Quản lý hạn sử dụng</Label>
          <NativeSelect
            id="expiry_level"
            value={v.expiry_level}
            onChange={(e) => set("expiry_level", e.target.value as ProductInput["expiry_level"])}
          >
            <option value="lot">Theo lô (nhập khi nhập hàng)</option>
            <option value="product">Một hạn cho cả sản phẩm</option>
            <option value="none">Không có hạn</option>
          </NativeSelect>
        </div>
        {v.expiry_level === "product" && (
          <div className="space-y-1.5">
            <Label htmlFor="expiry_date">Hạn sử dụng *</Label>
            <Input
              id="expiry_date"
              type="date"
              value={v.expiry_date ?? ""}
              onChange={(e) => set("expiry_date", e.target.value || null)}
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="min_stock">Tồn tối thiểu</Label>
          <Input
            id="min_stock"
            type="number"
            inputMode="decimal"
            min={0}
            value={v.min_stock ?? ""}
            placeholder="Theo cấu hình chung"
            onChange={(e) => set("min_stock", e.target.value === "" ? null : Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="max_stock">Tồn tối đa</Label>
          <Input
            id="max_stock"
            type="number"
            inputMode="decimal"
            min={0}
            value={v.max_stock ?? ""}
            placeholder="Mặc định = tối thiểu x 3"
            onChange={(e) => set("max_stock", e.target.value === "" ? null : Number(e.target.value))}
          />
        </div>

        {!id && (
          <div className="space-y-1.5">
            <Label htmlFor="barcode">Mã vạch nhà sản xuất</Label>
            <Input
              id="barcode"
              value={v.barcode ?? ""}
              onChange={(e) => set("barcode", e.target.value || null)}
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              placeholder="Quét hoặc nhập mã"
              inputMode="numeric"
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="status">Trạng thái</Label>
          <NativeSelect id="status" value={v.status} onChange={(e) => set("status", e.target.value as "active" | "inactive")}>
            <option value="active">Đang bán</option>
            <option value="inactive">Ngừng bán (ẩn khỏi quầy)</option>
          </NativeSelect>
        </div>
        <div className="space-y-1.5 @md:col-span-2 @3xl:col-span-3">
          <Label htmlFor="note">Ghi chú</Label>
          <Textarea id="note" value={v.note ?? ""} onChange={(e) => set("note", e.target.value || null)} rows={1} className="min-h-9" />
        </div>
      </fieldset>
      {!readOnly && (
        <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 -mx-4 -mb-4 flex flex-wrap items-center gap-3 rounded-b-xl border-t bg-card/95 px-4 py-3 backdrop-blur lg:bottom-0">
          <Button type="submit" disabled={pending || (!!id && !dirty)} className="h-10 px-5">
            {pending ? "Đang lưu..." : id ? "Lưu thay đổi" : "Tạo sản phẩm"}
          </Button>
          {id && (
            <span aria-live="polite" className={dirty ? "text-sm font-medium text-chu-amber" : "text-sm text-muted-foreground"}>
              {dirty ? "Có thay đổi chưa lưu" : "Đã lưu"}
            </span>
          )}
        </div>
      )}
      <QuickBrandDialog
        open={brandOpen}
        onOpenChange={setBrandOpen}
        brands={brandList}
        onPicked={(b) => {
          setBrandList((ls) => (ls.some((x) => x.id === b.id) ? ls : [...ls, b].sort((x, y) => x.name.localeCompare(y.name, "vi"))));
          set("brand_id", b.id);
        }}
      />
    </form>
  );
}

export function QuickBrandDialog({
  open,
  onOpenChange,
  brands,
  onPicked,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  brands: Option[];
  onPicked: (b: Option) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // Hop thoai render qua portal nhung su kien submit van noi bot len form san pham
    e.stopPropagation();
    setError(null);
    const n = name.trim();
    const done = (b: Option) => {
      onPicked(b);
      setName("");
      onOpenChange(false);
    };
    // Trung ten (khong phan biet hoa thuong) thi chon luon thuong hieu da co
    const existing = brands.find((b) => b.name.toLocaleLowerCase("vi") === n.toLocaleLowerCase("vi"));
    if (existing) {
      toast.info(`Đã có thương hiệu ${existing.name}, đã chọn`);
      return done(existing);
    }
    start(async () => {
      const res = await quickCreateBrand(n);
      if (!res.ok) return setError(res.error);
      toast.success(`Đã thêm thương hiệu ${res.data!.name}`);
      done(res.data!);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex min-h-0 flex-col gap-3">
          <DialogHeader>
            <DialogTitle>Thêm thương hiệu</DialogTitle>
            <DialogDescription>Tạo nhanh thương hiệu chưa có trong danh sách. Sửa tên ở Cài đặt &gt; Nhóm hàng &amp; thương hiệu.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            {error && (
              <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="qb-name">Tên thương hiệu *</Label>
              <Input id="qb-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? "Đang tạo..." : "Tạo và chọn"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
