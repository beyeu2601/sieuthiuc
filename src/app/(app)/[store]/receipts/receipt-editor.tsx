"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PlusIcon, TrashIcon } from "lucide-react";
import { cancelReceipt, confirmReceipt, quickCreateProduct, quickCreateSupplier, saveReceipt, type ReceiptPayload } from "./actions";
import type { CatalogItem } from "../catalog-actions";
import { formatMoney } from "@/lib/format";
import { GOODS_TYPE_LABEL } from "@/lib/text";
import { ProductPicker } from "@/components/product-picker";
import { MoneyInput } from "@/components/money-input";
import { LuaChon } from "@/components/lua-chon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormWizard } from "@/components/ui/form-wizard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { COST_TYPE_LABEL } from "./labels";

export type EditorLine = {
  key: string;
  product_id: string;
  name: string;
  sku: string;
  unit: string;
  goods_type: "cont" | "air";
  expiry_level: "none" | "product" | "lot";
  qty: number;
  unit_cost: number | null;
  lot_no: string;
  expiry_date: string;
  sell_price: number | null;
};
export type EditorCost = { key: string; cost_type: string; amount: number | null; allocation: "by_value" | "by_qty"; note: string };
export type Supplier = { id: string; name: string; code: string; payment_terms_days: number };
export type Account = { id: string; name: string; kind: string };

const newKey = () => Math.random().toString(36).slice(2);

export function ReceiptEditor({
  storeId,
  storeCode,
  receiptId,
  suppliers: initialSuppliers,
  accounts,
  canCreateProduct,
  canCreateSupplier,
  initial,
  canConfirm,
  autoOpenConfirm = false,
}: {
  storeId: string;
  storeCode: string;
  receiptId: string | null;
  suppliers: Supplier[];
  accounts: Account[];
  canCreateProduct: boolean;
  canCreateSupplier: boolean;
  initial: {
    supplier_id: string;
    receipt_date: string;
    invoice_no: string;
    due_date: string;
    note: string;
    lines: EditorLine[];
    costs: EditorCost[];
  };
  canConfirm: boolean;
  autoOpenConfirm?: boolean;
}) {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [h, setH] = useState({
    supplier_id: initial.supplier_id,
    receipt_date: initial.receipt_date,
    invoice_no: initial.invoice_no,
    due_date: initial.due_date,
    note: initial.note,
  });
  const [lines, setLines] = useState<EditorLine[]>(initial.lines);
  const [costs, setCosts] = useState<EditorCost[]>(initial.costs);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(autoOpenConfirm && canConfirm);
  const [addOpen, setAddOpen] = useState(false);

  const subtotal = useMemo(() => lines.reduce((s, l) => s + Math.round(l.qty * (l.unit_cost ?? 0)), 0), [lines]);
  const extra = useMemo(() => costs.reduce((s, c) => s + (c.amount ?? 0), 0), [costs]);
  const supplier = suppliers.find((s) => s.id === h.supplier_id);
  // Gop cac dong lien nhau cung san pham (tao boi "Them lo/date khac") vao mot the
  const groups = useMemo(() => {
    const gs: EditorLine[][] = [];
    for (const l of lines) {
      const g = gs[gs.length - 1];
      if (g && g[0].product_id === l.product_id) g.push(l);
      else gs.push([l]);
    }
    return gs;
  }, [lines]);

  function addProduct(it: CatalogItem) {
    setLines((ls) => {
      const i = ls.findIndex((l) => l.product_id === it.product_id);
      if (i >= 0) {
        const copy = [...ls];
        copy[i] = { ...copy[i], qty: copy[i].qty + it.pack_qty };
        toast.message(`${it.name}: số lượng ${copy[i].qty}`);
        return copy;
      }
      return [
        ...ls,
        {
          key: newKey(),
          product_id: it.product_id,
          name: it.name,
          sku: it.sku,
          unit: it.unit,
          goods_type: it.goods_type,
          expiry_level: it.expiry_level,
          qty: it.pack_qty,
          unit_cost: null,
          lot_no: "",
          expiry_date: "",
          sell_price: it.sell_price ?? null,
        },
      ];
    });
  }

  const upd = (key: string, patch: Partial<EditorLine>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  // Them mot dong nua cho cung san pham de nhap them lo/HSD khac trong cung phieu
  function addLot(l: EditorLine) {
    setLines((ls) => {
      const idx = ls.findIndex((x) => x.key === l.key);
      const clone: EditorLine = { ...l, key: newKey(), qty: 1, lot_no: "", expiry_date: "" };
      const copy = [...ls];
      copy.splice(idx + 1, 0, clone);
      return copy;
    });
  }

  function payload(): ReceiptPayload {
    return {
      id: receiptId,
      store_id: storeId,
      supplier_id: h.supplier_id,
      receipt_date: h.receipt_date,
      invoice_no: h.invoice_no || null,
      due_date: h.due_date || null,
      note: h.note || null,
      items: lines.map((l) => ({
        product_id: l.product_id,
        qty: l.qty,
        unit_cost: l.unit_cost ?? 0,
        lot_no: l.lot_no || null,
        expiry_date: l.expiry_date || null,
        sell_price: l.sell_price,
      })),
      costs: costs
        .filter((c) => (c.amount ?? 0) > 0)
        .map((c) => ({ cost_type: c.cost_type, amount: c.amount!, allocation: c.allocation, note: c.note || null })),
    };
  }

  function validate(forConfirm: boolean): string | null {
    if (!h.supplier_id) return "Chọn nhà cung cấp";
    if (lines.length === 0) return "Thêm ít nhất một dòng hàng";
    for (const l of lines) {
      if (!(l.qty > 0)) return `${l.name}: số lượng phải lớn hơn 0`;
      if (l.unit_cost == null) return `${l.name}: nhập đơn giá nhập`;
      if (forConfirm && l.expiry_level === "lot" && !l.expiry_date) return `${l.name}: nhập hạn sử dụng`;
    }
    return null;
  }

  function save(thenConfirm: boolean) {
    const invalid = validate(thenConfirm);
    if (invalid) return setError(invalid);
    setError(null);
    start(async () => {
      const res = await saveReceipt(storeCode, payload());
      if (!res.ok) return setError(res.error);
      if (thenConfirm) {
        if (!receiptId) router.replace(`/${storeCode}/receipts/${res.data!.id}?confirm=1`);
        else setConfirmOpen(true);
        return;
      }
      toast.success(`Đã lưu nháp ${res.data!.code}`);
      if (!receiptId) router.replace(`/${storeCode}/receipts/${res.data!.id}`);
      else router.refresh();
    });
  }

  // Ly do buoc "Hang nhap" chua di tiep duoc; cung dieu kien voi validate(false)
  const lineIssue = (() => {
    if (lines.length === 0) return "Thêm ít nhất một dòng hàng";
    for (const l of lines) {
      if (!(l.qty > 0)) return `${l.name}: số lượng phải lớn hơn 0`;
      if (l.unit_cost == null) return `${l.name}: nhập đơn giá nhập`;
    }
    return null;
  })();
  const total = subtotal + extra;
  const termsDays = supplier?.payment_terms_days ?? 0;
  const missingExpiry = lines.filter((l) => l.expiry_level === "lot" && !l.expiry_date);

  const headerStep = (
    <section className="@container rounded-xl border bg-card p-4">
      <div className="grid gap-3 @md:grid-cols-2 @3xl:grid-cols-4">
        <div className="space-y-1.5 @md:col-span-2">
          <Label htmlFor="supplier">Nhà cung cấp *</Label>
          <div className="flex gap-2">
            <LuaChon
              id="supplier"
              aria-label="Nhà cung cấp"
              className="min-w-0 flex-1"
              value={h.supplier_id}
              onChange={(v) => setH({ ...h, supplier_id: v })}
              options={
                // Tren 3 NCC la danh sach tha xuong: can dong "Chon" de o chon khop trang thai chua chon
                suppliers.length > 3
                  ? [{ value: "", label: "Chọn nhà cung cấp" }, ...suppliers.map((s) => ({ value: s.id, label: `${s.name} (${s.code})` }))]
                  : suppliers.map((s) => ({ value: s.id, label: s.name }))
              }
            />
            {canCreateSupplier && (
              <Button type="button" variant="outline" className="shrink-0" onClick={() => setSupplierOpen(true)}>
                <PlusIcon /> Thêm NCC
              </Button>
            )}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rdate">Ngày nhập *</Label>
          <Input id="rdate" type="date" value={h.receipt_date} onChange={(e) => setH({ ...h, receipt_date: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inv">Số hóa đơn NCC</Label>
          <Input id="inv" value={h.invoice_no} onChange={(e) => setH({ ...h, invoice_no: e.target.value })} />
        </div>
        <div className="space-y-1.5 @md:col-span-2 @3xl:col-span-4">
          <Label htmlFor="note">Ghi chú</Label>
          <Textarea id="note" rows={1} value={h.note} onChange={(e) => setH({ ...h, note: e.target.value })} />
        </div>
      </div>
    </section>
  );

  const reviewStep = (
    <section className="space-y-3 rounded-xl border bg-card p-4 text-sm">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="text-muted-foreground">Nhà cung cấp</dt>
        <dd>{supplier ? `${supplier.name} (${supplier.code})` : "-"}</dd>
        <dt className="text-muted-foreground">Ngày nhập</dt>
        <dd>{h.receipt_date ? new Date(`${h.receipt_date}T00:00:00`).toLocaleDateString("vi-VN") : "-"}</dd>
        <dt className="text-muted-foreground">Số hóa đơn</dt>
        <dd>{h.invoice_no || "-"}</dd>
      </dl>
      <div>
        <h3 className="mb-1 font-medium">{lines.length} dòng hàng</h3>
        {lines.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {lines.map((l, i) => (
              <li key={l.key} className="flex items-baseline justify-between gap-3 px-3 py-2">
                <span className="min-w-0">
                  {i + 1}. {l.name}
                  <span className="block text-xs text-muted-foreground">
                    {l.qty} {l.unit} x {formatMoney(l.unit_cost ?? 0)}
                    {l.expiry_date ? ` - HSD ${new Date(`${l.expiry_date}T00:00:00`).toLocaleDateString("vi-VN")}` : ""}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums">{formatMoney(Math.round(l.qty * (l.unit_cost ?? 0)))}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {costs.some((c) => (c.amount ?? 0) > 0) && (
        <div>
          <h3 className="mb-1 font-medium">Chi phí kèm theo</h3>
          <ul className="space-y-0.5">
            {costs
              .filter((c) => (c.amount ?? 0) > 0)
              .map((c) => (
                <li key={c.key} className="flex justify-between gap-3">
                  <span>
                    {COST_TYPE_LABEL[c.cost_type]}
                    {c.note ? ` - ${c.note}` : ""}
                  </span>
                  <span className="tabular-nums">{formatMoney(c.amount)}</span>
                </li>
              ))}
          </ul>
        </div>
      )}
      {canConfirm && missingExpiry.length > 0 && (
        <p className="rounded-lg border border-vien-amber bg-nen-amber px-3 py-2 text-chu-amber">
          Cần nhập hạn sử dụng trước khi xác nhận nhập kho: {missingExpiry.map((l) => l.name).join(", ")}. Lưu nháp vẫn được.
        </p>
      )}
      {receiptId && (
        <div className="border-t pt-3">
          <CancelButton storeCode={storeCode} receiptId={receiptId} />
        </div>
      )}
    </section>
  );

  const linesStep = (
    <section className="@container space-y-3 rounded-xl border bg-card p-4">
      <h2 className="font-medium">Hàng nhập</h2>
      <ProductPicker storeId={storeId} onPick={addProduct} showStock={false} />
      {canCreateProduct && (
        <div>
          <Button type="button" variant="outline" size="sm" onClick={() => setAddOpen(true)}>
            <PlusIcon /> Thêm sản phẩm
          </Button>
        </div>
      )}
      {lines.length === 0 ? (
        <p className="text-xs text-muted-foreground">Quét mã vạch hoặc tìm tên. Quét lại cùng mã sẽ tăng số lượng.</p>
      ) : (
        <div className="space-y-2">
          {groups.map((g, gi) => {
            const head = g[0];
            const last = g[g.length - 1];
            return (
              <div key={head.key} className="space-y-2 rounded-lg border p-3">
                <div>
                  <div className="text-sm font-medium">
                    {gi + 1}. {head.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {head.sku} - {GOODS_TYPE_LABEL[head.goods_type]} - Thành tiền{" "}
                    {formatMoney(g.reduce((s, l) => s + Math.round(l.qty * (l.unit_cost ?? 0)), 0))}
                  </div>
                </div>
                {g.map((l, li) => (
                <div key={l.key} className={`grid grid-cols-2 gap-2 @md:grid-cols-3 @md:items-end @2xl:grid-cols-[90px_1fr_1fr_1fr_150px_auto] ${li > 0 ? "border-t pt-2" : ""}`}>
                  <label className="space-y-1 text-xs text-muted-foreground">
                    SL ({l.unit})
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      value={l.qty}
                      onChange={(e) => upd(l.key, { qty: Number(e.target.value) })}
                    />
                  </label>
                  <label className="space-y-1 text-xs text-muted-foreground">
                    Đơn giá nhập
                    <MoneyInput value={l.unit_cost} onChange={(n) => upd(l.key, { unit_cost: n })} />
                  </label>
                  <label className="space-y-1 text-xs text-muted-foreground">
                    Giá bán
                    <MoneyInput value={l.sell_price} onChange={(n) => upd(l.key, { sell_price: n })} />
                  </label>
                  <label className="space-y-1 text-xs text-muted-foreground">
                    Số lô
                    <Input value={l.lot_no} placeholder="Theo mã phiếu" onChange={(e) => upd(l.key, { lot_no: e.target.value })} />
                  </label>
                  <label className="space-y-1 text-xs text-muted-foreground">
                    Hạn sử dụng{l.expiry_level === "lot" ? " *" : ""}
                    <Input type="date" value={l.expiry_date} onChange={(e) => upd(l.key, { expiry_date: e.target.value })} />
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Xóa dòng ${l.name}${g.length > 1 ? ` lô ${li + 1}` : ""}`}
                    onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                  >
                    <TrashIcon />
                  </Button>
                </div>
                ))}
                <button
                  type="button"
                  onClick={() => addLot(last)}
                  title="Cùng mặt hàng nhưng khác số lô hoặc hạn sử dụng thì thêm một dòng nữa"
                  className="min-h-11 text-sm font-medium text-primary underline underline-offset-2"
                >
                  + Thêm lô/date khác
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  const costsStep = (
    <section className="@container space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium" title="Vận chuyển, thuế, phí được cộng vào giá vốn từng dòng hàng khi xác nhận (theo giá trị hoặc theo số lượng)">
          Chi phí kèm theo
        </h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setCosts((c) => [...c, { key: newKey(), cost_type: "shipping", amount: null, allocation: "by_value", note: "" }])}
        >
          Thêm chi phí
        </Button>
      </div>
      {costs.map((c) => (
        <div key={c.key} className="grid grid-cols-2 gap-2 @2xl:grid-cols-[150px_160px_220px_1fr_auto] @2xl:items-end">
          <LuaChon
            aria-label="Loại chi phí"
            value={c.cost_type}
            onChange={(v) => setCosts((cs) => cs.map((x) => (x.key === c.key ? { ...x, cost_type: v } : x)))}
            options={Object.entries(COST_TYPE_LABEL).map(([k, v]) => ({ value: k, label: v }))}
          />
          <MoneyInput
            aria-label="Số tiền"
            value={c.amount}
            onChange={(n) => setCosts((cs) => cs.map((x) => (x.key === c.key ? { ...x, amount: n } : x)))}
          />
          <LuaChon
            aria-label="Cách phân bổ"
            value={c.allocation}
            onChange={(v) => setCosts((cs) => cs.map((x) => (x.key === c.key ? { ...x, allocation: v as "by_value" | "by_qty" } : x)))}
            options={[
              { value: "by_value", label: "Theo giá trị" },
              { value: "by_qty", label: "Theo SL" },
            ]}
          />
          <Input
            aria-label="Ghi chú chi phí"
            placeholder="Ghi chú"
            value={c.note}
            onChange={(e) => setCosts((cs) => cs.map((x) => (x.key === c.key ? { ...x, note: e.target.value } : x)))}
          />
          <Button type="button" variant="ghost" size="icon" aria-label="Xóa chi phí" onClick={() => setCosts((cs) => cs.filter((x) => x.key !== c.key))}>
            <TrashIcon />
          </Button>
        </div>
      ))}
    </section>
  );

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <FormWizard
          buocDau={receiptId ? 3 : 0}
          buoc={[
            {
              id: "ncc",
              nhan: "Nhà cung cấp",
              hopLe: !!h.supplier_id && !!h.receipt_date,
              lyDo: !h.supplier_id ? "Chọn nhà cung cấp" : "Chọn ngày nhập",
              noiDung: headerStep,
            },
            { id: "hang", nhan: "Hàng nhập", hopLe: lineIssue == null, lyDo: lineIssue, noiDung: linesStep },
            { id: "chiphi", nhan: "Chi phí", hopLe: true, noiDung: costsStep },
            { id: "kiemtra", nhan: "Kiểm tra", hopLe: true, noiDung: reviewStep },
          ]}
          // Dien thoai: tru chieu cao thanh tab duoi day (h-16) de hang nut khong bi che
          lopChan="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 lg:bottom-0"
          chanTrai={
            <div className="lg:hidden">
              Tổng phiếu <strong className="text-base tabular-nums">{formatMoney(total)}</strong>
              <div className="text-xs text-muted-foreground">
                Hàng {formatMoney(subtotal)} + chi phí {formatMoney(extra)}
              </div>
            </div>
          }
          nutPhu={
            <Button type="button" variant="outline" className="h-11" disabled={pending} onClick={() => save(false)}>
              {pending ? "Đang lưu..." : "Lưu nháp"}
            </Button>
          }
          nutCuoi={
            canConfirm && (
              <Button type="button" className="h-11" disabled={pending} onClick={() => save(true)}>
                Xác nhận nhập kho
              </Button>
            )
          }
        />

        {/* May tinh: tom tat cap nhat ngay khi nhap, dinh ben phai */}
        <aside className="hidden space-y-3 rounded-xl border bg-card p-4 text-sm lg:sticky lg:top-6 lg:block" aria-label="Tóm tắt phiếu">
          <h2 className="font-medium">Tóm tắt</h2>
          <dl className="grid grid-cols-2 gap-y-1">
            <dt className="text-muted-foreground">Nhà cung cấp</dt>
            <dd className="truncate text-right">{supplier?.name ?? "-"}</dd>
            <dt className="text-muted-foreground">Số dòng</dt>
            <dd className="text-right tabular-nums">{lines.length}</dd>
            <dt className="text-muted-foreground">Tiền hàng</dt>
            <dd className="text-right tabular-nums">{formatMoney(subtotal)}</dd>
            <dt className="text-muted-foreground">Chi phí</dt>
            <dd className="text-right tabular-nums">{formatMoney(extra)}</dd>
            <dt className="font-medium">Tổng phiếu</dt>
            <dd className="text-right text-base font-semibold tabular-nums">{formatMoney(total)}</dd>
          </dl>
          {supplier && total > 0 && (
            <p className="border-t pt-3 text-xs text-muted-foreground">
              Nếu chưa trả: công nợ {formatMoney(total)}
              {termsDays > 0 && h.receipt_date
                ? `, hạn ${new Date(`${addDays(h.receipt_date, termsDays)}T00:00:00`).toLocaleDateString("vi-VN")} (${termsDays} ngày)`
                : ", nhà cung cấp không cho nợ"}
              . Số tiền trả chọn ở bước xác nhận.
            </p>
          )}
        </aside>
      </div>

      {receiptId && (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          storeCode={storeCode}
          receiptId={receiptId}
          total={subtotal + extra}
          termsDays={supplier?.payment_terms_days ?? 0}
          receiptDate={h.receipt_date}
          accounts={accounts}
        />
      )}

      <QuickSupplierDialog
        open={supplierOpen}
        onOpenChange={setSupplierOpen}
        onCreated={(s) => {
          setSuppliers((ls) => [...ls, s].sort((a, b) => a.name.localeCompare(b.name, "vi")));
          setH((prev) => ({ ...prev, supplier_id: s.id }));
        }}
      />

      <QuickProductDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={(p) =>
          setLines((ls) => [
            ...ls,
            {
              key: newKey(),
              product_id: p.product_id,
              name: p.name,
              sku: p.sku,
              unit: p.unit,
              goods_type: p.goods_type,
              expiry_level: p.expiry_level,
              qty: 1,
              unit_cost: null,
              lot_no: "",
              expiry_date: "",
              sell_price: p.sell_price || null,
            },
          ])
        }
      />
    </div>
  );
}

function QuickSupplierDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (s: Supplier) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [terms, setTerms] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await quickCreateSupplier({ name, phone, payment_terms_days: terms });
      if (!res.ok) return setError(res.error);
      onCreated(res.data!);
      toast.success(`Đã thêm nhà cung cấp ${res.data!.code}`);
      setName("");
      setPhone("");
      setTerms(0);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex min-h-0 flex-col gap-3">
          <DialogHeader>
            <DialogTitle>Thêm nhà cung cấp</DialogTitle>
            <DialogDescription>Mã NCC tự sinh. Sửa thêm ở màn Nhà cung cấp.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            {error && (
              <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="qs-name">Tên nhà cung cấp *</Label>
              <Input id="qs-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="qs-phone">Điện thoại</Label>
                <Input id="qs-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="qs-terms">Số ngày được nợ</Label>
                <Input
                  id="qs-terms"
                  type="number"
                  min={0}
                  max={365}
                  value={terms}
                  onChange={(e) => setTerms(Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
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

function QuickProductDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (p: {
    product_id: string;
    sku: string;
    name: string;
    unit: string;
    goods_type: "cont" | "air";
    expiry_level: "none" | "product" | "lot";
    sell_price: number;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [goodsType, setGoodsType] = useState<"cont" | "air">("air");
  const [unit, setUnit] = useState("");
  const [sellPrice, setSellPrice] = useState<number | null>(null);
  const [dateType, setDateType] = useState<"short" | "long">("long");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

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
              {pending ? "Đang tạo..." : "Tạo và thêm vào phiếu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CancelButton({ storeCode, receiptId }: { storeCode: string; receiptId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      className="h-10 text-destructive"
      disabled={pending}
      onClick={() => {
        const reason = prompt("Lý do hủy phiếu nháp?");
        if (!reason?.trim()) return;
        start(async () => {
          const res = await cancelReceipt(storeCode, receiptId, reason);
          if (!res.ok) return void toast.error(res.error);
          toast.success("Đã hủy phiếu");
          router.refresh();
        });
      }}
    >
      Hủy phiếu
    </Button>
  );
}

function addDays(d: string, n: number) {
  const x = new Date(`${d}T00:00:00`);
  x.setDate(x.getDate() + n);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  storeCode,
  receiptId,
  total,
  termsDays,
  receiptDate,
  accounts,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  storeCode: string;
  receiptId: string;
  total: number;
  termsDays: number;
  receiptDate: string;
  accounts: Account[];
}) {
  const router = useRouter();
  const kindForMethod: Record<"cash" | "transfer" | "other", string> = { cash: "cash", transfer: "bank", other: "ewallet" };
  const pickAccount = (m: "cash" | "transfer" | "other") => accounts.find((a) => a.kind === kindForMethod[m])?.id ?? accounts[0]?.id ?? "";
  const [paid, setPaid] = useState<number | null>(termsDays === 0 ? total : 0);
  const [method, setMethod] = useState<"cash" | "transfer" | "other">("transfer");
  const [account, setAccount] = useState<string>(pickAccount("transfer"));
  const [due, setDue] = useState(addDays(receiptDate, termsDays));
  const [inShift, setInShift] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const remaining = total - (paid ?? 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if ((paid ?? 0) > total) return setError("Số tiền trả không được lớn hơn tổng phiếu");
    if ((paid ?? 0) > 0 && accounts.length > 0 && !account) return setError("Chọn tài khoản giữ tiền");
    start(async () => {
      const res = await confirmReceipt(storeCode, receiptId, paid ?? 0, method, remaining > 0 ? due : null, inShift, account || null);
      if (!res.ok) return setError(res.error);
      toast.success("Đã nhập kho");
      onOpenChange(false);
      router.replace(`/${storeCode}/receipts/${receiptId}`);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex min-h-0 flex-col gap-3">
          <DialogHeader>
            <DialogTitle>Xác nhận nhập kho</DialogTitle>
            <DialogDescription>
              Tổng phiếu {formatMoney(total)}. Sau khi xác nhận, tồn kho và công nợ được cập nhật, phiếu không sửa được nữa.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            {error && (
              <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="paid">Đã trả nhà cung cấp</Label>
              <MoneyInput id="paid" value={paid} onChange={setPaid} />
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setPaid(total)}>
                  Trả đủ
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setPaid(0)}>
                  Chưa trả
                </Button>
              </div>
            </div>
            {(paid ?? 0) > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="method">Phương thức</Label>
                <LuaChon
                  id="method"
                  aria-label="Phương thức"
                  value={method}
                  onChange={(v) => {
                    const m = v as typeof method;
                    setMethod(m);
                    setAccount((a) => a || pickAccount(m));
                  }}
                  options={[
                    { value: "transfer", label: "Chuyển khoản" },
                    { value: "cash", label: "Tiền mặt" },
                    { value: "other", label: "Khác" },
                  ]}
                />
                {accounts.length > 0 && (
                  <div className="pt-1">
                    <Label htmlFor="acc">Tài khoản giữ tiền</Label>
                    <LuaChon
                      id="acc"
                      aria-label="Tài khoản giữ tiền"
                      value={account}
                      onChange={setAccount}
                      options={[
                        // Tren 3 tai khoan la danh sach tha xuong, giu dong "Chon" cho trang thai chua chon
                        ...(accounts.length > 3 ? [{ value: "", label: "Chọn tài khoản" }] : []),
                        ...accounts.map((a) => ({ value: a.id, label: a.name })),
                      ]}
                    />
                  </div>
                )}
                {method === "cash" && (
                  <label className="flex items-center gap-2 pt-1 text-sm">
                    <input type="checkbox" className="size-4" checked={inShift} onChange={(e) => setInShift(e.target.checked)} />
                    Lấy tiền từ két ca đang mở của tôi (trừ vào tiền mặt ca)
                  </label>
                )}
              </div>
            )}
            {remaining > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="due">Hạn thanh toán phần còn nợ ({formatMoney(remaining)})</Label>
                <Input id="due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Để sau
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Đang xác nhận..." : "Xác nhận"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
