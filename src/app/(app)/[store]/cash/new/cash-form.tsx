"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createCash, requestCashChange, type CashPayload } from "../actions";
import { MoneyInput } from "@/components/money-input";
import { LuaChon } from "@/components/lua-chon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Phuong thuc suy ra tu loai tai khoan nguoi dung bam chon
const methodForKind = (kind: string): CashPayload["method"] => (kind === "cash" ? "cash" : kind === "bank" ? "transfer" : "other");

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
  const defaultAccount = accounts.find((a) => a.kind === "cash") ?? accounts[0];
  const [initial] = useState<Omit<CashPayload, "store_id" | "amount"> & { amount: number | null }>(() => ({
    kind: "expense",
    category_id: "",
    occurred_on: today,
    description: "",
    amount: null,
    method: defaultAccount ? methodForKind(defaultAccount.kind) : "cash",
    counterparty: null,
    doc_no: null,
    note: null,
    payment_status: "paid",
    record_in_shift: isStaff || openShiftCode !== null,
    account_id: defaultAccount?.id ?? null,
    ...edit?.initial,
  }));
  const [v, setV] = useState(initial);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const cats = categories.filter((c) => c.kind === v.kind);
  // Man sua: chi gui khi co thay doi
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);

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
    <form onSubmit={submit} className="@container space-y-4 rounded-xl border bg-card p-4">
      <fieldset disabled={pending} className="grid gap-x-4 gap-y-3 @md:grid-cols-2 @3xl:grid-cols-4">
        {!edit && (
          <div className="space-y-1.5">
            <Label htmlFor="kind">Loại</Label>
            <LuaChon
              id="kind"
              aria-label="Loại"
              value={v.kind}
              onChange={(x) => setV({ ...v, kind: x as "income" | "expense", category_id: "" })}
              options={[
                { value: "expense", label: "Xin chi" },
                { value: "income", label: "Báo thu" },
              ]}
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="cat">Nhóm *</Label>
          <LuaChon
            id="cat"
            aria-label="Nhóm"
            value={v.category_id}
            onChange={(x) => setV({ ...v, category_id: x })}
            options={[
              // It nhom thi hien nut bam, khong can dong "Chon nhom"
              ...(cats.length > 3 ? [{ value: "", label: "Chọn nhóm" }] : []),
              ...cats.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="amount">Số tiền *</Label>
          <MoneyInput id="amount" value={v.amount} onChange={(n) => setV({ ...v, amount: n })} className="h-11 text-base" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="date">Ngày phát sinh *</Label>
          <Input id="date" type="date" value={v.occurred_on} onChange={(e) => setV({ ...v, occurred_on: e.target.value })} />
        </div>
        <div className="space-y-1.5 @md:col-span-2">
          <Label htmlFor="desc">Nội dung *</Label>
          <Input id="desc" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} placeholder="Ví dụ: Tiền điện tháng 9" />
        </div>
        <div className="space-y-1.5 @md:col-span-2">
          <Label htmlFor="acc">{accounts.length > 0 ? "Tài khoản giữ tiền *" : "Phương thức"}</Label>
          {accounts.length > 0 ? (
            <LuaChon
              id="acc"
              aria-label="Tài khoản giữ tiền"
              value={v.account_id ?? ""}
              onChange={(x) => {
                const a = accounts.find((acc) => acc.id === x);
                if (a) setV((s) => ({ ...s, method: methodForKind(a.kind), account_id: a.id }));
              }}
              options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            />
          ) : (
            <LuaChon
              id="acc"
              aria-label="Phương thức"
              value={v.method}
              onChange={(x) => setV((s) => ({ ...s, method: x as CashPayload["method"], account_id: null }))}
              options={[
                { value: "cash", label: "Tiền mặt" },
                { value: "transfer", label: "Chuyển khoản" },
                { value: "other", label: "Khác" },
              ]}
            />
          )}
        </div>
        {!isStaff && (
          <>
            {!edit && (
              <div className="space-y-1.5">
                <Label htmlFor="ps" title="Chưa trả: vẫn tính vào lãi lỗ, theo dõi ở mục Phải trả khác">
                  Thanh toán
                </Label>
                <LuaChon
                  id="ps"
                  aria-label="Tình trạng thanh toán"
                  value={v.payment_status}
                  onChange={(x) => setV({ ...v, payment_status: x as "paid" | "unpaid" })}
                  options={[
                    { value: "paid", label: "Đã trả/thu" },
                    { value: "unpaid", label: "Chưa trả" },
                  ]}
                />
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
              <label className="flex min-h-10 items-center gap-2 text-sm @md:col-span-2">
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
          <p className="text-xs text-muted-foreground @md:col-span-2">Tiền mặt tính vào két của ca {openShiftCode} sau khi được duyệt.</p>
        )}
        <div className="space-y-1.5 @md:col-span-2 @3xl:col-span-4">
          <Label htmlFor="cnote">Ghi chú</Label>
          <Textarea id="cnote" rows={1} value={v.note ?? ""} onChange={(e) => setV({ ...v, note: e.target.value || null })} className="min-h-9" />
        </div>
        {edit && (
          <div className="space-y-1.5 @md:col-span-2 @3xl:col-span-4">
            <Label htmlFor="reason">Lý do sửa *</Label>
            <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ví dụ: ghi nhầm số tiền" />
          </div>
        )}
      </fieldset>
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 -mx-4 -mb-4 flex flex-wrap items-center gap-3 rounded-b-xl border-t bg-card/95 px-4 py-3 backdrop-blur lg:bottom-0">
        <Button type="submit" className="h-10 px-5" disabled={pending || (!!edit && !dirty)}>
          {pending ? "Đang gửi..." : edit ? "Gửi yêu cầu sửa" : "Gửi"}
        </Button>
        {edit ? (
          <span aria-live="polite" className={dirty ? "text-sm font-medium text-chu-amber" : "text-sm text-muted-foreground"}>
            {dirty ? "Có thay đổi chưa lưu" : "Chưa thay đổi gì"}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Người giữ tài khoản duyệt xong mới vào số dư</span>
        )}
      </div>
    </form>
  );
}
