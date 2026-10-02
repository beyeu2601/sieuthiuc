"use client";

import { createContext, useContext, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { bulkUpdateProducts } from "./actions";
import { QuickBrandDialog } from "./product-form";
import { baoTheoKetQua } from "@/lib/feedback";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";

// Chon nhieu san pham tren danh sach roi gan nhom hang / thuong hieu mot lan.
// Log 02/10/2026: quan ly sua tay ~240 san pham tung cai de doi nhom hang va thuong hieu.

type Option = { id: string; name: string };
type Ctx = { selected: Set<string>; toggle: (id: string) => void; setAll: (ids: string[], on: boolean) => void; clear: () => void };

const SelectCtx = createContext<Ctx | null>(null);

export function BulkSelectProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const value: Ctx = {
    selected,
    toggle: (id) =>
      setSelected((s) => {
        const n = new Set(s);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      }),
    setAll: (ids, on) =>
      setSelected((s) => {
        const n = new Set(s);
        for (const id of ids) {
          if (on) n.add(id);
          else n.delete(id);
        }
        return n;
      }),
    clear: () => setSelected(new Set()),
  };
  return <SelectCtx.Provider value={value}>{children}</SelectCtx.Provider>;
}

function useSel() {
  const c = useContext(SelectCtx);
  if (!c) throw new Error("BulkSelectProvider missing");
  return c;
}

// Vung cham 44px bao quanh o tick
export function SelectBox({ id, label }: { id: string; label: string }) {
  const { selected, toggle } = useSel();
  return (
    <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center">
      <input type="checkbox" className="size-5" aria-label={`Chọn ${label}`} checked={selected.has(id)} onChange={() => toggle(id)} />
    </label>
  );
}

export function SelectAllBox({ ids }: { ids: string[] }) {
  const { selected, setAll } = useSel();
  const all = ids.length > 0 && ids.every((id) => selected.has(id));
  return (
    <label className="flex size-11 cursor-pointer items-center justify-center">
      <input type="checkbox" className="size-5" aria-label="Chọn tất cả sản phẩm trên trang" checked={all} onChange={() => setAll(ids, !all)} />
    </label>
  );
}

export function BulkBar({ categories, brands: initialBrands }: { categories: Option[]; brands: Option[] }) {
  const { selected, clear } = useSel();
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [brands, setBrands] = useState(initialBrands);
  const [cat, setCat] = useState("");
  const [brand, setBrand] = useState("");
  const [brandOpen, setBrandOpen] = useState(false);
  const [pending, start] = useTransition();

  if (selected.size === 0) return null;

  async function apply() {
    const catName = categories.find((c) => c.id === cat)?.name;
    const brandName = brands.find((b) => b.id === brand)?.name;
    const parts = [catName && `nhóm hàng "${catName}"`, brandName && `thương hiệu "${brandName}"`].filter(Boolean).join(" và ");
    const ok = await confirm({
      title: `Gán cho ${selected.size} sản phẩm?`,
      description: `Đặt ${parts} cho ${selected.size} sản phẩm đã chọn. Giá trị cũ của các sản phẩm này sẽ bị thay.`,
      confirmLabel: "Gán",
    });
    if (!ok) return;
    start(async () => {
      const res = await bulkUpdateProducts([...selected], { category_id: cat || undefined, brand_id: brand || undefined });
      if (baoTheoKetQua(res, `Đã cập nhật ${res.ok ? res.data?.count : 0} sản phẩm`)) {
        clear();
        setCat("");
        setBrand("");
        router.refresh();
      }
    });
  }

  return (
    <div
      role="region"
      aria-label="Thao tác với sản phẩm đã chọn"
      className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 mt-3 rounded-xl border bg-card p-3 shadow-lg lg:bottom-0"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium" aria-live="polite">
          Đã chọn {selected.size}
        </span>
        <NativeSelect value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Nhóm hàng cần gán" className="h-11 min-w-40 flex-1">
          <option value="">Nhóm hàng: giữ nguyên</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
        <div className="flex min-w-48 flex-1 gap-1">
          <NativeSelect value={brand} onChange={(e) => setBrand(e.target.value)} aria-label="Thương hiệu cần gán" className="h-11 flex-1">
            <option value="">Thương hiệu: giữ nguyên</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </NativeSelect>
          <Button type="button" variant="outline" className="size-11" aria-label="Thêm thương hiệu" onClick={() => setBrandOpen(true)}>
            <PlusIcon aria-hidden />
          </Button>
        </div>
        <Button className="h-11" onClick={apply} disabled={pending || (!cat && !brand)}>
          {pending ? "Đang gán..." : "Gán"}
        </Button>
        <Button variant="ghost" className="h-11" onClick={clear} disabled={pending}>
          Bỏ chọn
        </Button>
      </div>
      <QuickBrandDialog
        open={brandOpen}
        onOpenChange={setBrandOpen}
        brands={brands}
        onPicked={(b) => {
          setBrands((list) => (list.some((x) => x.id === b.id) ? list : [...list, b].sort((x, y) => x.name.localeCompare(y.name, "vi"))));
          setBrand(b.id);
        }}
      />
      {dialog}
    </div>
  );
}
