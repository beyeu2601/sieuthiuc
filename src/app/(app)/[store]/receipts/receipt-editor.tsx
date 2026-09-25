"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TrashIcon } from "lucide-react";
import { cancelReceipt, confirmReceipt, saveReceipt, type ReceiptPayload } from "./actions";
import type { CatalogItem } from "../catalog-actions";
import { formatMoney } from "@/lib/format";
import { GOODS_TYPE_LABEL } from "@/lib/text";
import { ProductPicker } from "@/components/product-picker";
import { MoneyInput } from "@/components/money-input";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
};
export type EditorCost = { key: string; cost_type: string; amount: number | null; allocation: "by_value" | "by_qty"; note: string };
export type Supplier = { id: string; name: string; code: string; payment_terms_days: number };

const COST_TYPES: Record<string, string> = { shipping: "Vận chuyển", tax: "Thuế", customs: "Hải quan", other: "Khác" };
const newKey = () => Math.random().toString(36).slice(2);

export function ReceiptEditor({
  storeId,
  storeCode,
  receiptId,
  suppliers,
  initial,
  canConfirm,
  autoOpenConfirm = false,
}: {
  storeId: string;
  storeCode: string;
  receiptId: string | null;
  suppliers: Supplier[];
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

  const subtotal = useMemo(() => lines.reduce((s, l) => s + Math.round(l.qty * (l.unit_cost ?? 0)), 0), [lines]);
  const extra = useMemo(() => costs.reduce((s, c) => s + (c.amount ?? 0), 0), [costs]);
  const supplier = suppliers.find((s) => s.id === h.supplier_id);

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
        },
      ];
    });
  }

  const upd = (key: string, patch: Partial<EditorLine>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

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
      })),
      costs: costs
        .filter((c) => (c.amount ?? 0) > 0)
        .map((c) => ({ cost_type: c.cost_type, amount: c.amount!, allocation: c.allocation, note: c.note || null })),
    };
  }

  function validate(forConfirm: boolean): string | null {
    if (!h.supplier_id) return "Chọn nhà cung cấp";
    if (lines.length === 0) return "Thêm ít nhất một dòng hàng";
    for (const [i, l] of lines.entries()) {
      if (!(l.qty > 0)) return `Dòng ${i + 1}: số lượng phải lớn hơn 0`;
      if (l.unit_cost == null) return `Dòng ${i + 1}: nhập đơn giá nhập`;
      if (forConfirm && l.expiry_level === "lot" && !l.expiry_date) return `Dòng ${i + 1} (${l.name}): nhập hạn sử dụng`;
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

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <section className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="supplier">Nhà cung cấp *</Label>
          <NativeSelect id="supplier" value={h.supplier_id} onChange={(e) => setH({ ...h, supplier_id: e.target.value })}>
            <option value="">Chọn nhà cung cấp</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rdate">Ngày nhập *</Label>
          <Input id="rdate" type="date" value={h.receipt_date} onChange={(e) => setH({ ...h, receipt_date: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inv">Số hóa đơn NCC</Label>
          <Input id="inv" value={h.invoice_no} onChange={(e) => setH({ ...h, invoice_no: e.target.value })} />
        </div>
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
          <Label htmlFor="note">Ghi chú</Label>
          <Textarea id="note" rows={1} value={h.note} onChange={(e) => setH({ ...h, note: e.target.value })} />
        </div>
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="font-medium">Hàng nhập</h2>
        <ProductPicker storeId={storeId} onPick={addProduct} showStock={false} autoFocus={!receiptId} />
        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">Quét mã vạch hoặc tìm tên để thêm hàng. Quét lại cùng mã sẽ tăng số lượng.</p>
        ) : (
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={l.key} className="grid grid-cols-2 gap-2 rounded-lg border p-3 md:grid-cols-[2fr_90px_140px_130px_140px_auto] md:items-end">
                <div className="col-span-2 md:col-span-1">
                  <div className="text-sm font-medium">
                    {i + 1}. {l.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {l.sku} - {GOODS_TYPE_LABEL[l.goods_type]} - Thành tiền {formatMoney(Math.round(l.qty * (l.unit_cost ?? 0)))}
                  </div>
                </div>
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
                  aria-label={`Xóa dòng ${l.name}`}
                  onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                >
                  <TrashIcon />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Chi phí kèm theo</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCosts((c) => [...c, { key: newKey(), cost_type: "shipping", amount: null, allocation: "by_value", note: "" }])}
          >
            Thêm chi phí
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Vận chuyển, thuế, phí được cộng vào giá vốn từng dòng hàng khi xác nhận (theo giá trị hoặc theo số lượng).
        </p>
        {costs.map((c) => (
          <div key={c.key} className="grid grid-cols-2 gap-2 md:grid-cols-[150px_160px_170px_1fr_auto] md:items-end">
            <NativeSelect
              aria-label="Loại chi phí"
              value={c.cost_type}
              onChange={(e) => setCosts((cs) => cs.map((x) => (x.key === c.key ? { ...x, cost_type: e.target.value } : x)))}
            >
              {Object.entries(COST_TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </NativeSelect>
            <MoneyInput
              aria-label="Số tiền"
              value={c.amount}
              onChange={(n) => setCosts((cs) => cs.map((x) => (x.key === c.key ? { ...x, amount: n } : x)))}
            />
            <NativeSelect
              aria-label="Cách phân bổ"
              value={c.allocation}
              onChange={(e) =>
                setCosts((cs) => cs.map((x) => (x.key === c.key ? { ...x, allocation: e.target.value as "by_value" | "by_qty" } : x)))
              }
            >
              <option value="by_value">Phân bổ theo giá trị</option>
              <option value="by_qty">Phân bổ theo số lượng</option>
            </NativeSelect>
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

      <section className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <div className="text-sm">
          <div>
            Tiền hàng <strong className="tabular-nums">{formatMoney(subtotal)}</strong> + chi phí{" "}
            <strong className="tabular-nums">{formatMoney(extra)}</strong>
          </div>
          <div className="text-lg">
            Tổng phiếu <strong className="tabular-nums">{formatMoney(subtotal + extra)}</strong>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {receiptId && <CancelButton storeCode={storeCode} receiptId={receiptId} />}
          <Button variant="outline" className="h-10" disabled={pending} onClick={() => save(false)}>
            {pending ? "Đang lưu..." : "Lưu nháp"}
          </Button>
          {canConfirm && (
            <Button className="h-10" disabled={pending} onClick={() => save(true)}>
              Xác nhận nhập kho
            </Button>
          )}
        </div>
      </section>

      {receiptId && (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          storeCode={storeCode}
          receiptId={receiptId}
          total={subtotal + extra}
          termsDays={supplier?.payment_terms_days ?? 0}
          receiptDate={h.receipt_date}
        />
      )}
    </div>
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
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  storeCode: string;
  receiptId: string;
  total: number;
  termsDays: number;
  receiptDate: string;
}) {
  const router = useRouter();
  const [paid, setPaid] = useState<number | null>(termsDays === 0 ? total : 0);
  const [method, setMethod] = useState<"cash" | "transfer" | "other">("transfer");
  const [due, setDue] = useState(addDays(receiptDate, termsDays));
  const [inShift, setInShift] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const remaining = total - (paid ?? 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if ((paid ?? 0) > total) return setError("Số tiền trả không được lớn hơn tổng phiếu");
    start(async () => {
      const res = await confirmReceipt(storeCode, receiptId, paid ?? 0, method, remaining > 0 ? due : null, inShift);
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
        <form onSubmit={submit} className="space-y-3">
          <DialogHeader>
            <DialogTitle>Xác nhận nhập kho</DialogTitle>
            <DialogDescription>
              Tổng phiếu {formatMoney(total)}. Sau khi xác nhận, tồn kho và công nợ được cập nhật, phiếu không sửa được nữa.
            </DialogDescription>
          </DialogHeader>
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
              <NativeSelect id="method" value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
                <option value="transfer">Chuyển khoản</option>
                <option value="cash">Tiền mặt</option>
                <option value="other">Khác</option>
              </NativeSelect>
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
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Để sau
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Đang xác nhận..." : "Xác nhận"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
