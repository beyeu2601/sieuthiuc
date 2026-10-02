"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createCash, requestCashChange, type CashPayload } from "../actions";
import { MoneyInput } from "@/components/money-input";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const kindForMethod: Record<CashPayload["method"], string> = { cash: "cash", transfer: "bank", other: "ewallet" };

export function CashForm({
  storeId,
  storeCode,
  categories,
  accounts,
  isStaff,
  openShiftCode,
  today,
  edit,
}: {
  storeId: string;
  storeCode: string;
  categories: { id: string; name: string; kind: "income" | "expense" }[];
  accounts: { id: string; name: string; kind: string }[];
  isStaff: boolean;
  openShiftCode: string | null;
  today: string;
  // Sua khoan da duyet: gui yeu cau kem ly do, nguoi giu tai khoan duyet
  edit?: { id: string; initial: Omit<CashPayload, "store_id" | "payment_status" | "record_in_shift"> };
}) {
  const router = useRouter();
  const pickAccount = (method: CashPayload["method"]) =>
    accounts.find((a) => a.kind === kindForMethod[method])?.id ?? accounts[0]?.id ?? "";
  const [v, setV] = useState<Omit<CashPayload, "store_id" | "amount"> & { amount: number | null }>({
    kind: "expense",
    category_id: "",
    occurred_on: today,
    description: "",
    amount: null,
    method: "cash",
    counterparty: null,
    doc_no: null,
    note: null,
    payment_status: "paid",
    record_in_shift: isStaff || openShiftCode !== null,
    account_id: pickAccount("cash") || null,
    ...edit?.initial,
  });
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const cats = categories.filter((c) => c.kind === v.kind);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!v.category_id) return void toast.error("Chọn nhóm");
    if (!v.amount) return void toast.error("Nhập số tiền");
    if (!v.description.trim()) return void toast.error("Nhập nội dung");
    if (accounts.length > 0 && !v.account_id) return void toast.error("Chọn tài khoản giữ tiền");
    if (edit) {
      if (!reason.trim()) return void toast.error("Nhập lý do sửa");
      const { category_id, occurred_on, description, method, counterparty, doc_no, note, account_id } = v;
      return start(async () => {
        const res = await requestCashChange(
          storeCode,
          edit.id,
          "edit",
          { category_id, occurred_on, description, amount: v.amount!, method, counterparty, doc_no, note, account_id },
          reason
        );
        if (!res.ok) return void toast.error(res.error);
        toast.success(res.data!.applied ? "Đã sửa" : "Đã gửi yêu cầu sửa, chờ người giữ tài khoản duyệt");
        router.push(`/${storeCode}/cash`);
      });
    }
    start(async () => {
      const res = await createCash(storeCode, { ...v, amount: v.amount!, store_id: storeId });
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.data!.approval_status === "pending" ? `Đã gửi ${res.data!.code}, chờ người giữ tài khoản duyệt` : `Đã ghi ${res.data!.code}`);
      router.push(`/${storeCode}/cash`);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-4">
      <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">
        {!edit && (
          <div className="space-y-1.5">
            <Label htmlFor="kind">Loại</Label>
            <NativeSelect id="kind" value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value as "income" | "expense", category_id: "" })}>
              <option value="expense">Xin chi</option>
              <option value="income">Báo thu</option>
            </NativeSelect>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="cat">Nhóm *</Label>
          <NativeSelect id="cat" value={v.category_id} onChange={(e) => setV({ ...v, category_id: e.target.value })}>
            <option value="">Chọn nhóm</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="amount">Số tiền *</Label>
          <MoneyInput id="amount" value={v.amount} onChange={(n) => setV({ ...v, amount: n })} className="h-11 text-base" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="date">Ngày phát sinh *</Label>
          <Input id="date" type="date" value={v.occurred_on} onChange={(e) => setV({ ...v, occurred_on: e.target.value })} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="desc">Nội dung *</Label>
          <Input id="desc" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} placeholder="Ví dụ: Tiền điện tháng 9" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="method">Phương thức</Label>
          <NativeSelect
            id="method"
            value={v.method}
            onChange={(e) => {
              const method = e.target.value as CashPayload["method"];
              setV((s) => ({ ...s, method, account_id: pickAccount(method) || s.account_id }));
            }}
          >
            <option value="cash">Tiền mặt</option>
            <option value="transfer">Chuyển khoản</option>
            <option value="other">Khác</option>
          </NativeSelect>
        </div>
        {!isStaff && (
          <>
            {!edit && (
              <div className="space-y-1.5">
                <Label htmlFor="ps">Tình trạng thanh toán</Label>
                <NativeSelect id="ps" value={v.payment_status} onChange={(e) => setV({ ...v, payment_status: e.target.value as "paid" | "unpaid" })}>
                  <option value="paid">Đã trả / đã thu</option>
                  <option value="unpaid">Chưa trả (phải trả khác)</option>
                </NativeSelect>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="cp">Đối tượng</Label>
              <Input id="cp" value={v.counterparty ?? ""} onChange={(e) => setV({ ...v, counterparty: e.target.value || null })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc">Số chứng từ</Label>
              <Input id="doc" value={v.doc_no ?? ""} onChange={(e) => setV({ ...v, doc_no: e.target.value || null })} />
            </div>
            {!edit && v.method === "cash" && openShiftCode && (
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={v.record_in_shift}
                  onChange={(e) => setV({ ...v, record_in_shift: e.target.checked })}
                />
                Tiền lấy từ / bỏ vào két của ca {openShiftCode}
              </label>
            )}
          </>
        )}
        {isStaff && !edit && v.method === "cash" && openShiftCode && (
          <p className="text-sm text-muted-foreground sm:col-span-2">Tiền mặt tính vào két của ca {openShiftCode} sau khi được duyệt.</p>
        )}
        {accounts.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="acc">Tài khoản giữ tiền *</Label>
            <NativeSelect id="acc" value={v.account_id ?? ""} onChange={(e) => setV({ ...v, account_id: e.target.value || null })}>
              <option value="">Chọn tài khoản</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="cnote">Ghi chú</Label>
          <Textarea id="cnote" rows={2} value={v.note ?? ""} onChange={(e) => setV({ ...v, note: e.target.value || null })} />
        </div>
        {edit && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="reason">Lý do sửa *</Label>
            <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ví dụ: ghi nhầm số tiền" />
          </div>
        )}
      </fieldset>
      <Button type="submit" className="h-11 px-6" disabled={pending}>
        {pending ? "Đang gửi..." : edit ? "Gửi yêu cầu sửa" : "Gửi"}
      </Button>
    </form>
  );
}
