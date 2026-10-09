"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PlusIcon, TrashIcon } from "lucide-react";
import { createPreorder, defaultCosts } from "../actions";
import { accountLabel, type MoneyAccount } from "../labels";
import type { CatalogItem } from "../../catalog-actions";
import { formatMoney, formatNumber } from "@/lib/format";
import { ProductPicker } from "@/components/product-picker";
import { QuickProductDialog } from "@/components/quick-product-dialog";
import { MoneyInput } from "@/components/money-input";
import { LuaChon } from "@/components/lua-chon";
import { Khoi } from "@/components/khoi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Line = { product_id: string; name: string; unit: string; onHand: number; qty: number; unit_price: number | null; unit_cost: number | null };

export function PreorderForm({
  storeId,
  storeCode,
  accounts,
  today,
  showCost,
  canCreateProduct,
}: {
  storeId: string;
  storeCode: string;
  accounts: MoneyAccount[];
  today: string;
  // nhan vien khong thay gia von; he thong tu lay gia von mac dinh
  showCost: boolean;
  canCreateProduct: boolean;
}) {
  const router = useRouter();
  const [h, setH] = useState({
    customer_name: "",
    customer_phone: "",
    ordered_on: today,
    due_on: "",
    deposit_type: "percent" as "percent" | "amount",
    deposit_percent: "",
    deposit_amount: null as number | null,
    account_id: "",
    paid_on: today,
    note: "",
  });
  const [lines, setLines] = useState<Line[]>([]);
  // null = dong; chuoi = ten dien san (rong khi bam nut Them san pham)
  const [newName, setNewName] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const subtotal = lines.reduce((s, l) => s + Math.round(l.qty * (l.unit_price ?? 0)), 0);
  const costTotal = lines.reduce((s, l) => s + Math.round(l.qty * (l.unit_cost ?? 0)), 0);
  const pct = Number(h.deposit_percent.replace(",", ".")) || 0;
  // Cung cach lam tron voi create_preorder
  const deposit = h.deposit_type === "percent" ? Math.round((subtotal * pct) / 100) : (h.deposit_amount ?? 0);

  function add(it: CatalogItem) {
    const i = lines.findIndex((l) => l.product_id === it.product_id);
    if (i >= 0) return setLines((ls) => ls.map((l, j) => (j === i ? { ...l, qty: l.qty + it.pack_qty } : l)));
    setLines((ls) => [
      ...ls,
      { product_id: it.product_id, name: it.name, unit: it.unit, onHand: it.qty_available, qty: it.pack_qty, unit_price: it.sell_price, unit_cost: null },
    ]);
    if (showCost) {
      defaultCosts(storeId, [it.product_id]).then((m) =>
        setLines((ls) => ls.map((l) => (l.product_id === it.product_id && l.unit_cost == null ? { ...l, unit_cost: m[it.product_id] ?? 0 } : l)))
      );
    }
  }

  function setLine(id: string, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.product_id === id ? { ...l, ...patch } : l)));
  }

  function submit() {
    if (!h.customer_name.trim()) return void toast.error("Nhập tên khách");
    if (!h.due_on) return void toast.error("Chọn ngày hẹn trả hàng");
    if (h.due_on < h.ordered_on) return void toast.error("Ngày hẹn trả phải từ ngày đặt trở đi");
    if (lines.some((l) => !(l.qty > 0) || l.unit_price == null)) return void toast.error("Kiểm tra số lượng và giá bán từng dòng");
    if (h.deposit_type === "percent" && (pct < 0 || pct > 100)) return void toast.error("Phần trăm cọc từ 0 đến 100");
    if (deposit > subtotal) return void toast.error("Tiền cọc lớn hơn tiền hàng");
    if (deposit > 0 && !h.account_id) return void toast.error("Chọn tài khoản nhận cọc");
    start(async () => {
      const res = await createPreorder(storeCode, {
        store_id: storeId,
        customer_name: h.customer_name.trim(),
        customer_phone: h.customer_phone.trim() || null,
        ordered_on: h.ordered_on,
        due_on: h.due_on,
        deposit_type: h.deposit_type,
        deposit_value: h.deposit_type === "percent" ? pct : (h.deposit_amount ?? 0),
        account_id: deposit > 0 ? h.account_id : null,
        paid_on: h.paid_on,
        note: h.note.trim() || null,
        items: lines.map((l) => ({ product_id: l.product_id, qty: l.qty, unit_price: l.unit_price ?? 0, unit_cost: showCost ? l.unit_cost : null })),
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Đã tạo đơn ${res.data!.code}`);
      router.push(`/${storeCode}/preorders/${res.data!.id}`);
    });
  }

  return (
    <div className="@container space-y-4">
      <Khoi title="Khách hàng">
        <div className="grid gap-x-4 gap-y-3 @md:grid-cols-2 @3xl:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="cname">Tên khách *</Label>
            <Input id="cname" autoComplete="off" value={h.customer_name} onChange={(e) => setH({ ...h, customer_name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cphone">Số điện thoại</Label>
            <Input id="cphone" type="tel" inputMode="tel" value={h.customer_phone} onChange={(e) => setH({ ...h, customer_phone: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ordered">Ngày đặt *</Label>
            <Input id="ordered" type="date" value={h.ordered_on} onChange={(e) => setH({ ...h, ordered_on: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="due">Ngày hẹn trả *</Label>
            <Input id="due" type="date" min={h.ordered_on} value={h.due_on} onChange={(e) => setH({ ...h, due_on: e.target.value })} />
          </div>
        </div>
      </Khoi>

      <Khoi title="Sản phẩm" className="space-y-3" aside={<span className="text-xs text-muted-foreground tabular-nums">{lines.length}</span>}>
        <ProductPicker storeId={storeId} onPick={add} onCreateNew={canCreateProduct ? (t) => setNewName(t) : undefined} />
        {canCreateProduct && (
          <div>
            <Button type="button" variant="outline" size="sm" onClick={() => setNewName("")}>
              <PlusIcon /> Thêm sản phẩm
            </Button>
          </div>
        )}
        {lines.length === 0 && <p className="text-sm text-muted-foreground">Tìm sản phẩm khách đặt. Hàng chưa có trong kho vẫn chọn được.</p>}
        {lines.map((l) => (
          <div
            key={l.product_id}
            className={`grid grid-cols-2 items-end gap-2 border-t pt-2 ${showCost ? "sm:grid-cols-[1fr_90px_130px_130px_110px_auto]" : "sm:grid-cols-[1fr_90px_130px_110px_auto]"}`}
          >
            <div className="col-span-2 text-sm sm:col-span-1">
              {l.name}
              <div className="text-xs text-muted-foreground">
                Trong kho {formatNumber(l.onHand)} {l.unit}
              </div>
            </div>
            <label className="text-xs text-muted-foreground">
              SL
              <Input type="number" inputMode="decimal" min={1} value={l.qty} onChange={(e) => setLine(l.product_id, { qty: Number(e.target.value) })} />
            </label>
            {showCost && (
              <label className="text-xs text-muted-foreground">
                Giá vốn
                <MoneyInput value={l.unit_cost} onChange={(n) => setLine(l.product_id, { unit_cost: n })} />
              </label>
            )}
            <label className="text-xs text-muted-foreground">
              Giá bán
              <MoneyInput value={l.unit_price} onChange={(n) => setLine(l.product_id, { unit_price: n })} />
            </label>
            <div className="text-right text-sm font-medium tabular-nums">{formatMoney(Math.round(l.qty * (l.unit_price ?? 0)))}</div>
            <Button variant="ghost" size="icon" aria-label={`Xóa ${l.name}`} onClick={() => setLines((ls) => ls.filter((x) => x.product_id !== l.product_id))}>
              <TrashIcon />
            </Button>
          </div>
        ))}
      </Khoi>

      <Khoi title="Tiền cọc">
        <div className="grid gap-x-4 gap-y-3 @md:grid-cols-2 @3xl:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="dtype">Cọc theo</Label>
            <LuaChon
              id="dtype"
              aria-label="Cọc theo"
              value={h.deposit_type}
              onChange={(v) => setH({ ...h, deposit_type: v as "percent" | "amount" })}
              options={[
                { value: "percent", label: "% tiền hàng" },
                { value: "amount", label: "Số tiền" },
              ]}
            />
          </div>
          <div className="space-y-1.5">
            {h.deposit_type === "percent" ? (
              <>
                <Label htmlFor="dpct">Phần trăm cọc</Label>
                <div className="relative">
                  <Input
                    id="dpct"
                    inputMode="decimal"
                    className="pr-8 text-right tabular-nums"
                    value={h.deposit_percent}
                    onChange={(e) => setH({ ...h, deposit_percent: e.target.value.replace(/[^\d.,]/g, "") })}
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                </div>
                <p className="text-xs text-muted-foreground tabular-nums">= {formatMoney(deposit)}</p>
              </>
            ) : (
              <>
                <Label htmlFor="damt">Số tiền cọc</Label>
                <MoneyInput id="damt" value={h.deposit_amount} onChange={(n) => setH({ ...h, deposit_amount: n })} />
                {subtotal > 0 && deposit > 0 && (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    = {((deposit / subtotal) * 100).toFixed(1).replace(".", ",")}% tiền hàng
                  </p>
                )}
              </>
            )}
          </div>
          {deposit > 0 && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="paidon">Ngày cọc</Label>
                <Input id="paidon" type="date" value={h.paid_on} onChange={(e) => setH({ ...h, paid_on: e.target.value })} />
              </div>
              <div className="space-y-1.5 @md:col-span-2 @3xl:col-span-4">
                <Label htmlFor="acc">Tài khoản nhận cọc *</Label>
                {accounts.length === 0 ? (
                  <p className="text-sm text-chu-red">Chưa có tài khoản tiền. Nhờ quản trị thêm ở Cài đặt.</p>
                ) : (
                  <LuaChon
                    id="acc"
                    aria-label="Tài khoản nhận cọc"
                    value={h.account_id}
                    onChange={(v) => setH({ ...h, account_id: v })}
                    options={[
                      ...(accounts.length > 3 ? [{ value: "", label: "Chọn tài khoản" }] : []),
                      ...accounts.map((a) => ({ value: a.id, label: accountLabel(a) })),
                    ]}
                  />
                )}
                {accounts.find((a) => a.id === h.account_id)?.kind === "cash" && (
                  <p className="text-xs text-muted-foreground">Tiền mặt vào két được cộng vào ca đang mở.</p>
                )}
              </div>
            </>
          )}
          <div className="space-y-1.5 @md:col-span-2 @3xl:col-span-4">
            <Label htmlFor="pnote">Ghi chú</Label>
            <Textarea id="pnote" rows={2} value={h.note} onChange={(e) => setH({ ...h, note: e.target.value })} />
          </div>
        </div>
      </Khoi>

      {/* Tong va nut tao luon thay khi danh sach dai; dien thoai tru chieu cao thanh tab duoi day */}
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm lg:bottom-0">
        <div className="text-sm tabular-nums">
          Tiền hàng {formatMoney(subtotal)} - cọc {formatMoney(deposit)}
          <div className="text-lg font-semibold">Còn lại {formatMoney(subtotal - deposit)}</div>
          {showCost && subtotal > 0 && <div className="text-xs text-muted-foreground">Lãi dự kiến {formatMoney(subtotal - costTotal)}</div>}
        </div>
        <Button className="h-11 px-6" disabled={pending || lines.length === 0} onClick={submit}>
          {pending ? "Đang tạo..." : deposit > 0 ? "Tạo đơn và ghi cọc" : "Tạo đơn"}
        </Button>
      </div>

      {canCreateProduct && (
        <QuickProductDialog
          open={newName != null}
          onOpenChange={(o) => !o && setNewName(null)}
          initialName={newName ?? ""}
          submitLabel="Tạo và thêm vào đơn"
          onCreated={(p) =>
            setLines((ls) => [
              ...ls,
              { product_id: p.product_id, name: p.name, unit: p.unit, onHand: 0, qty: 1, unit_price: p.sell_price, unit_cost: showCost ? 0 : null },
            ])
          }
        />
      )}
    </div>
  );
}
