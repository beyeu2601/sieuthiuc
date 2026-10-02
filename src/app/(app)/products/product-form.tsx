"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";
import { quickCreateBrand, saveProduct } from "./actions";
import type { ProductInput } from "@/lib/schemas/product";
import { formatMoney } from "@/lib/format";
import { MoneyInput } from "@/components/money-input";
import { LuaChon } from "@/components/lua-chon";
import { CategoryInfo } from "@/components/category-info";
import { GoiY } from "@/components/goi-y";
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
          <LuaChon
            id="goods_type"
            aria-label="Loại hàng"
            value={v.goods_type}
            onChange={(x) => set("goods_type", x as "cont" | "air")}
            options={[
              { value: "cont", label: "Cont" },
              { value: "air", label: "Air" },
            ]}
          />
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
          <LuaChon
            id="category"
            aria-label="Nhóm hàng"
            value={v.category_id ?? ""}
            onChange={(x) => set("category_id", x || null)}
            options={[
              { value: "", label: "Chưa phân nhóm" },
              ...categories.map((c) => ({ value: c.id, label: `${c.name}${c.benefit_pct != null ? ` (${c.benefit_pct}%)` : ""}` })),
            ]}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="brand">Thương hiệu</Label>
          <div className="flex gap-2">
            <LuaChon
              id="brand"
              aria-label="Thương hiệu"
              value={v.brand_id ?? ""}
              onChange={(x) => set("brand_id", x || null)}
              options={[{ value: "", label: "Không có" }, ...brandList.map((b) => ({ value: b.id, label: b.name }))]}
            />
            {!readOnly && (
              <Button type="button" variant="outline" className="shrink-0" onClick={() => setBrandOpen(true)}>
                <PlusIcon /> Thêm
              </Button>
            )}
          </div>
        </div>

        {!id && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label htmlFor="cost_price_ref">Giá vốn (₫)</Label>
              <GoiY label="Giá vốn">
                <p>Không bắt buộc, có thể nhập sau ở trang sản phẩm.</p>
                <p>Khi xác nhận phiếu nhập, giá vốn tự cập nhật theo bình quân.</p>
              </GoiY>
            </div>
            <MoneyInput id="cost_price_ref" value={v.cost_price_ref ?? 0} onChange={(n) => set("cost_price_ref", n ?? 0)} />
          </div>
        )}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1">
            <Label htmlFor="pricing_method">Cách đặt giá</Label>
            <GoiY label="Cách đặt giá">
              <p>Nhập trực tiếp: tự gõ giá bán.</p>
              <p>
                % Benefit: giá bán = giá vốn x (1 + %), làm tròn {formatMoney(roundingUnit)}. Để trống % thì lấy % của nhóm hàng.
              </p>
            </GoiY>
          </div>
          <LuaChon
            id="pricing_method"
            aria-label="Cách đặt giá"
            value={v.pricing_method}
            onChange={(x) => set("pricing_method", x as "manual" | "benefit")}
            options={[
              { value: "manual", label: "Nhập trực tiếp" },
              { value: "benefit", label: "% Benefit" },
            ]}
          />
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
          <div className="flex items-center gap-1">
            <Label htmlFor="date_type">Loại date (cận date)</Label>
            <GoiY label="Loại date">
              <p>Lô còn ít ngày hơn ngưỡng thì màn Hạn sử dụng gợi ý giá giảm.</p>
              <p>Date ngắn và date dài có ngưỡng riêng (mặc định 15 và 60 ngày), sửa ở Cài đặt &gt; Cấu hình.</p>
            </GoiY>
          </div>
          <LuaChon
            id="date_type"
            aria-label="Loại date"
            value={v.date_type}
            onChange={(x) => set("date_type", x as "short" | "long")}
            options={[
              { value: "long", label: "Date dài" },
              { value: "short", label: "Date ngắn" },
            ]}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-1">
            <Label htmlFor="expiry_level">Quản lý hạn sử dụng</Label>
            <GoiY label="Quản lý hạn sử dụng">
              <p>Theo lô: mỗi lần nhập ghi hạn riêng, bán trừ lô gần hết hạn trước.</p>
              <p>Một hạn: một hạn sử dụng chung cho sản phẩm.</p>
              <p>Không có: hàng không theo dõi hạn.</p>
            </GoiY>
          </div>
          <LuaChon
            id="expiry_level"
            aria-label="Quản lý hạn sử dụng"
            value={v.expiry_level}
            onChange={(x) => set("expiry_level", x as ProductInput["expiry_level"])}
            options={[
              { value: "lot", label: "Theo lô" },
              { value: "product", label: "Một hạn" },
              { value: "none", label: "Không có" },
            ]}
          />
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
          <LuaChon
            id="status"
            aria-label="Trạng thái"
            value={v.status}
            onChange={(x) => set("status", x as "active" | "inactive")}
            options={[
              { value: "active", label: "Đang bán" },
              { value: "inactive", label: "Ngừng bán" },
            ]}
          />
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
