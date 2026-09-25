"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { MinusIcon, PlusIcon, TrashIcon } from "lucide-react";
import { completeSale, requestDiscountApproval } from "./actions";
import type { CatalogItem } from "../catalog-actions";
import { formatMoney, formatNumber } from "@/lib/format";
import { ProductPicker } from "@/components/product-picker";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Line = {
  product_id: string;
  name: string;
  sku: string;
  unit: string;
  price: number;
  available: number;
  qty: number;
  discount: number;
};

type Cart = {
  key: string;
  lines: Line[];
  orderDiscount: number;
  cash: number | null;
  transfer: number | null;
  other: number | null;
  given: number | null;
  approvalId: string | null;
  approvedBy: string | null;
};

const newCart = (): Cart => ({
  key: crypto.randomUUID(),
  lines: [],
  orderDiscount: 0,
  cash: null,
  transfer: null,
  other: null,
  given: null,
  approvalId: null,
  approvedBy: null,
});

export function PosClient({
  storeId,
  storeCode,
  shiftId,
  shiftCode,
  maxDiscountPct,
}: {
  storeId: string;
  storeCode: string;
  shiftId: string;
  shiftCode: string;
  maxDiscountPct: number | null;
}) {
  const storageKey = `pos-cart-${storeCode}`;
  const [cart, setCart] = useState<Cart>(newCart);
  const [loaded, setLoaded] = useState(false);
  const [pending, start] = useTransition();
  const [approvalOpen, setApprovalOpen] = useState(false);
  const discountRef = useRef<HTMLInputElement>(null);

  // gio hang giu trong trinh duyet cho toi khi thanh toan (SPEC F1.1)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setCart({ ...newCart(), ...JSON.parse(saved) });
    } catch {
      /* bo qua */
    }
    setLoaded(true);
  }, [storageKey]);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(cart));
    } catch {
      /* bo qua */
    }
  }, [cart, loaded, storageKey]);

  const subtotal = useMemo(() => cart.lines.reduce((s, l) => s + Math.round(l.qty * l.price) - l.discount, 0), [cart.lines]);
  const lineDiscount = useMemo(() => cart.lines.reduce((s, l) => s + l.discount, 0), [cart.lines]);
  const total = Math.max(0, subtotal - cart.orderDiscount);
  const paid = (cart.cash ?? 0) + (cart.transfer ?? 0) + (cart.other ?? 0);
  const change = cart.given != null && cart.cash != null ? cart.given - cart.cash : null;
  const manualDiscount = lineDiscount + cart.orderDiscount;
  const needApproval = maxDiscountPct != null && manualDiscount > (subtotal * maxDiscountPct) / 100 && !cart.approvalId;

  const set = (patch: Partial<Cart>) => setCart((c) => ({ ...c, ...patch }));

  function addItem(it: CatalogItem) {
    setCart((c) => {
      const i = c.lines.findIndex((l) => l.product_id === it.product_id);
      const current = i >= 0 ? c.lines[i].qty : 0;
      if (current + it.pack_qty > it.qty_available) {
        toast.error(`${it.name}: chỉ còn ${formatNumber(it.qty_available)}`);
        return c;
      }
      if (i >= 0) {
        const lines = [...c.lines];
        lines[i] = { ...lines[i], qty: current + it.pack_qty, available: it.qty_available, price: it.sell_price };
        return { ...c, lines };
      }
      return {
        ...c,
        lines: [
          ...c.lines,
          {
            product_id: it.product_id,
            name: it.name,
            sku: it.sku,
            unit: it.unit,
            price: it.sell_price,
            available: it.qty_available,
            qty: it.pack_qty,
            discount: 0,
          },
        ],
      };
    });
  }

  function setQty(id: string, qty: number) {
    setCart((c) => ({
      ...c,
      lines: c.lines.map((l) => {
        if (l.product_id !== id) return l;
        if (qty > l.available) {
          toast.error(`${l.name}: chỉ còn ${formatNumber(l.available)}`);
          return { ...l, qty: l.available };
        }
        return { ...l, qty: Math.max(0, qty), discount: Math.min(l.discount, Math.round(Math.max(0, qty) * l.price)) };
      }),
    }));
  }

  const pay = useCallback(() => {
    if (cart.lines.length === 0) return void toast.error("Giỏ hàng trống");
    if (cart.lines.some((l) => !(l.qty > 0))) return void toast.error("Có dòng số lượng bằng 0");
    if (needApproval) return setApprovalOpen(true);
    // mac dinh tra toan bo bang tien mat neu chua nhap
    const payments = paid === 0 ? { cash: total, transfer: null, other: null } : { cash: cart.cash, transfer: cart.transfer, other: cart.other };
    const sum = (payments.cash ?? 0) + (payments.transfer ?? 0) + (payments.other ?? 0);
    if (sum !== total) return void toast.error(`Tiền thanh toán ${formatMoney(sum)} chưa bằng tổng ${formatMoney(total)}`);
    // mo cua so in truoc (trinh duyet chan popup neu mo sau await)
    const printWin = window.open("", "_blank", "width=420,height=640");
    start(async () => {
      const res = await completeSale(storeCode, {
        store_id: storeId,
        shift_id: shiftId,
        idempotency_key: cart.key,
        discount_amount: cart.orderDiscount,
        approval_id: cart.approvalId,
        note: null,
        items: cart.lines.map((l) => ({ product_id: l.product_id, qty: l.qty, discount_amount: l.discount })),
        payments: (
          [
            ["cash", payments.cash],
            ["transfer", payments.transfer],
            ["other", payments.other],
          ] as const
        )
          .filter(([, a]) => (a ?? 0) > 0)
          .map(([method, amount]) => ({ method, amount: amount!, reference: null })),
      });
      if (!res.ok) {
        printWin?.close();
        toast.error(res.error, { duration: 8000 });
        return;
      }
      toast.success(`Đã thanh toán ${res.data!.code} - ${formatMoney(res.data!.total)}`);
      if (printWin) printWin.location.href = `/print/receipt/${res.data!.id}?auto=1`;
      setCart(newCart());
      document.getElementById("pos-search")?.focus();
    });
  }, [cart, needApproval, paid, total, storeCode, storeId, shiftId]);

  // Phim tat: F2 tim, F4 thanh toan, F8 giam gia don
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "F2") {
        e.preventDefault();
        document.getElementById("pos-search")?.focus();
      } else if (e.key === "F4") {
        e.preventDefault();
        pay();
      } else if (e.key === "F8") {
        e.preventDefault();
        discountRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pay]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <section className="space-y-3" aria-label="Giỏ hàng">
        <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            Ca <Link href={`/${storeCode}/shifts/${shiftId}`} className="underline underline-offset-4">{shiftCode}</Link>. Phím tắt: F2 tìm, F4 thanh
            toán, F8 giảm giá.
          </span>
          {cart.lines.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (confirm("Xóa toàn bộ giỏ hàng?")) setCart(newCart());
              }}
            >
              Xóa giỏ
            </Button>
          )}
        </div>
        <ProductPicker id="pos-search" storeId={storeId} onPick={addItem} autoFocus />
        {cart.lines.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-background px-4 py-10 text-center text-sm text-muted-foreground">
            Quét mã vạch để thêm hàng. Quét lại cùng mã sẽ tăng số lượng.
          </p>
        ) : (
          <ul className="divide-y rounded-xl border bg-background">
            {cart.lines.map((l) => (
              <li key={l.product_id} className="grid grid-cols-[1fr_auto] gap-2 p-3 sm:grid-cols-[1fr_150px_120px_110px_auto] sm:items-center">
                <div>
                  <div className="font-medium">{l.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatMoney(l.price)} / {l.unit} - còn {formatNumber(l.available)}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="size-10" aria-label={`Giảm ${l.name}`} onClick={() => setQty(l.product_id, l.qty - 1)}>
                    <MinusIcon />
                  </Button>
                  <Input
                    type="number"
                    inputMode="decimal"
                    aria-label={`Số lượng ${l.name}`}
                    value={l.qty}
                    onChange={(e) => setQty(l.product_id, Number(e.target.value))}
                    className="h-10 w-14 text-center"
                  />
                  <Button variant="outline" size="icon" className="size-10" aria-label={`Tăng ${l.name}`} onClick={() => setQty(l.product_id, l.qty + 1)}>
                    <PlusIcon />
                  </Button>
                </div>
                <label className="text-xs text-muted-foreground">
                  Giảm dòng
                  <MoneyInput
                    value={l.discount || null}
                    onChange={(n) =>
                      set({
                        lines: cart.lines.map((x) =>
                          x.product_id === l.product_id ? { ...x, discount: Math.min(n ?? 0, Math.round(x.qty * x.price)) } : x
                        ),
                        approvalId: null,
                        approvedBy: null,
                      })
                    }
                    className="h-9"
                  />
                </label>
                <div className="text-right font-semibold tabular-nums">{formatMoney(Math.round(l.qty * l.price) - l.discount)}</div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-10"
                  aria-label={`Xóa ${l.name}`}
                  onClick={() => set({ lines: cart.lines.filter((x) => x.product_id !== l.product_id) })}
                >
                  <TrashIcon />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside className="space-y-3 lg:sticky lg:top-32 lg:self-start" aria-label="Thanh toán">
        <div className="space-y-3 rounded-xl border bg-background p-4">
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt>Tiền hàng</dt>
            <dd className="text-right tabular-nums">{formatMoney(subtotal + lineDiscount)}</dd>
            {lineDiscount > 0 && (
              <>
                <dt>Giảm theo dòng</dt>
                <dd className="text-right tabular-nums">-{formatMoney(lineDiscount)}</dd>
              </>
            )}
          </dl>
          <div className="space-y-1">
            <Label htmlFor="order-discount">Giảm giá đơn (F8)</Label>
            <div className="flex gap-1">
              <MoneyInput
                id="order-discount"
                ref={discountRef}
                value={cart.orderDiscount || null}
                onChange={(n) => set({ orderDiscount: Math.min(n ?? 0, subtotal), approvalId: null, approvedBy: null })}
              />
              {[5, 10].map((pct) => (
                <Button
                  key={pct}
                  type="button"
                  variant="outline"
                  onClick={() => set({ orderDiscount: Math.round((subtotal * pct) / 100), approvalId: null, approvedBy: null })}
                >
                  {pct}%
                </Button>
              ))}
            </div>
            {maxDiscountPct != null && manualDiscount > 0 && (
              <p className={`text-xs ${needApproval ? "text-destructive" : "text-muted-foreground"}`}>
                {cart.approvedBy
                  ? `Đã được ${cart.approvedBy} duyệt giảm giá.`
                  : needApproval
                    ? `Vượt hạn mức ${maxDiscountPct}%: cần quản lý nhập PIN khi thanh toán.`
                    : `Trong hạn mức ${maxDiscountPct}%.`}
              </p>
            )}
          </div>
          <div className="flex items-baseline justify-between border-t pt-3">
            <span className="text-lg">Khách trả</span>
            <span className="text-3xl font-bold tabular-nums">{formatMoney(total)}</span>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border bg-background p-4">
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => set({ cash: total, transfer: null, other: null })}>
              Tất cả tiền mặt
            </Button>
            <Button type="button" variant="outline" className="flex-1" onClick={() => set({ cash: null, transfer: total, other: null, given: null })}>
              Tất cả chuyển khoản
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-sm">
              Tiền mặt
              <MoneyInput value={cart.cash} onChange={(n) => set({ cash: n })} />
            </label>
            <label className="space-y-1 text-sm">
              Chuyển khoản
              <MoneyInput value={cart.transfer} onChange={(n) => set({ transfer: n })} />
            </label>
            <label className="space-y-1 text-sm">
              Khác
              <MoneyInput value={cart.other} onChange={(n) => set({ other: n })} />
            </label>
            <label className="space-y-1 text-sm">
              Khách đưa (tiền mặt)
              <MoneyInput value={cart.given} onChange={(n) => set({ given: n })} />
            </label>
          </div>
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt>Đã nhập thanh toán</dt>
            <dd className={`text-right tabular-nums ${paid !== total && paid !== 0 ? "text-destructive" : ""}`}>
              {paid === 0 ? "Tiền mặt toàn bộ" : formatMoney(paid)}
            </dd>
            {change != null && (
              <>
                <dt className="font-medium">Tiền thối</dt>
                <dd className={`text-right text-lg font-semibold tabular-nums ${change < 0 ? "text-destructive" : ""}`}>
                  {formatMoney(change)}
                </dd>
              </>
            )}
          </dl>
          <Button className="h-14 w-full text-lg" disabled={pending || cart.lines.length === 0} onClick={pay}>
            {pending ? "Đang thanh toán..." : `Thanh toán ${formatMoney(total)} (F4)`}
          </Button>
        </div>
      </aside>

      <ApprovalDialog
        open={approvalOpen}
        onOpenChange={setApprovalOpen}
        storeId={storeId}
        onApproved={(id, name) => {
          set({ approvalId: id, approvedBy: name });
          setApprovalOpen(false);
          toast.success(`${name} đã duyệt giảm giá. Bấm thanh toán lại.`);
        }}
      />
    </div>
  );
}

function ApprovalDialog({
  open,
  onOpenChange,
  storeId,
  onApproved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  storeId: string;
  onApproved: (id: string, name: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await requestDiscountApproval(storeId, username, pin);
      setPin("");
      if (!res.ok) return setError(res.error);
      onApproved(res.data!.approval_id, res.data!.approved_by_name);
    });
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-3">
          <DialogHeader>
            <DialogTitle>Quản lý duyệt giảm giá</DialogTitle>
            <DialogDescription>Giảm giá vượt hạn mức của nhân viên. Quản lý nhập tên đăng nhập và mã PIN.</DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="mgr">Tên đăng nhập quản lý</Label>
            <Input id="mgr" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pin">Mã PIN</Label>
            <Input id="pin" type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={pending || !username || !pin}>
              Duyệt
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
