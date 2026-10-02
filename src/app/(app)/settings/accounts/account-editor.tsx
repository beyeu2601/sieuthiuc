"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveMoneyAccount, setMoneyAccountHolder, type MoneyAccountInput } from "../actions";
import { formatMoney } from "@/lib/format";
import { MoneyInput } from "@/components/money-input";
import { LuaChon } from "@/components/lua-chon";
import { ChipSac } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type AccountRow = {
  id: string;
  name: string;
  kind: "cash" | "bank" | "ewallet" | "other";
  is_active: boolean;
  opening_balance: number;
  balance: number;
  holder_id: string | null;
};

type User = { id: string; full_name: string };

export const KIND_LABEL: Record<AccountRow["kind"], string> = {
  cash: "Tiền mặt",
  bank: "Ngân hàng",
  ewallet: "Ví điện tử",
  other: "Khác",
};

function AccountCard({
  row,
  users,
  isSadmin,
  storeCode,
  onSaved,
}: {
  row: AccountRow | null;
  users: User[];
  isSadmin: boolean;
  storeCode: string | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState(row?.name ?? "");
  const [kind, setKind] = useState<AccountRow["kind"]>(row?.kind ?? "cash");
  const [opening, setOpening] = useState<number | null>(row?.opening_balance ?? null);
  const [active, setActive] = useState(row?.is_active ?? true);
  const [holder, setHolder] = useState(row?.holder_id ?? "");
  const [pending, start] = useTransition();
  const p = row?.id ?? "new";

  const accountDirty = !row || name !== row.name || kind !== row.kind || (opening ?? 0) !== row.opening_balance || active !== row.is_active;
  const holderDirty = holder !== (row?.holder_id ?? "");
  const dirty = (isSadmin && accountDirty) || holderDirty;

  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      let id = row?.id ?? null;
      if (isSadmin && accountDirty) {
        const input: MoneyAccountInput = { id, name, kind, opening_balance: opening ?? 0, is_active: active, note: null };
        const res = await saveMoneyAccount(input);
        if (!res.ok) return void toast.error(res.error);
        id = res.data!.id;
      }
      if (id && holderDirty) {
        const res = await setMoneyAccountHolder(id, holder || null);
        if (!res.ok) return void toast.error(res.error);
      }
      toast.success(row ? "Đã lưu tài khoản" : "Đã thêm tài khoản");
      if (!row) {
        setName("");
        setOpening(null);
        setHolder("");
      }
      onSaved();
    });
  }

  const negative = (row?.balance ?? 0) < 0;
  return (
    <form onSubmit={save} className="@container space-y-3 rounded-xl border bg-card p-4" aria-label={row ? `Tài khoản ${row.name}` : "Thêm tài khoản"}>
      {row ? (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{row.name}</h3>
            <ChipSac sac="slate">{KIND_LABEL[row.kind]}</ChipSac>
            {!row.is_active && <ChipSac sac="red">Ngừng dùng</ChipSac>}
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Số dư hiện tại</div>
            <div className={`text-lg font-semibold tabular-nums ${negative ? "text-chu-red" : ""}`}>{formatMoney(row.balance)}</div>
            {negative && (
              <div className="text-xs text-chu-red" title="Kiểm tra số dư đầu kỳ hoặc khoản ghi nhầm tài khoản">
                Số dư âm
              </div>
            )}
          </div>
        </div>
      ) : (
        <h3 className="font-medium">Thêm tài khoản</h3>
      )}

      <fieldset disabled={pending} className="grid gap-x-4 gap-y-3 @md:grid-cols-2 @3xl:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor={`${p}-name`}>Tên tài khoản</Label>
          <Input
            id={`${p}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!isSadmin}
            placeholder={row ? "" : "Ví dụ: VCB - Công ty"}
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${p}-kind`}>Loại</Label>
          <LuaChon
            id={`${p}-kind`}
            aria-label="Loại tài khoản"
            value={kind}
            onChange={(x) => setKind(x as AccountRow["kind"])}
            disabled={!isSadmin}
            className="h-11"
            options={Object.entries(KIND_LABEL).map(([k, v]) => ({ value: k, label: v }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${p}-opening`}>Số dư đầu kỳ</Label>
          <MoneyInput id={`${p}-opening`} value={opening} onChange={setOpening} disabled={!isSadmin} className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${p}-holder`} title="Người giữ quỹ duyệt thu chi của tài khoản này">
            Người giữ quỹ
          </Label>
          <LuaChon
            id={`${p}-holder`}
            aria-label="Người giữ quỹ"
            value={holder}
            onChange={setHolder}
            className={users.length + 1 > 3 ? "h-11" : undefined}
            options={[{ value: "", label: "Chưa có - quản lý cửa hàng duyệt" }, ...users.map((u) => ({ value: u.id, label: u.full_name }))]}
          />
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-4">
          {row && (
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" className="size-5" checked={active} onChange={(e) => setActive(e.target.checked)} disabled={!isSadmin || pending} />
              Đang dùng
            </label>
          )}
          {row && storeCode && (
            <Link href={`/${storeCode}/cash/accounts/${row.id}`} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              Xem sổ thu chi -&gt;
            </Link>
          )}
        </div>
        <Button type="submit" className="h-11 px-6" variant={row ? "outline" : "default"} disabled={pending || !dirty || !name.trim()}>
          {pending ? "Đang lưu..." : row ? "Lưu thay đổi" : "Thêm tài khoản"}
        </Button>
      </div>
    </form>
  );
}

export function AccountEditor({ rows, users, isSadmin, storeCode }: { rows: AccountRow[]; users: User[]; isSadmin: boolean; storeCode: string | null }) {
  const router = useRouter();
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <AccountCard
          key={`${r.id}-${r.name}-${r.kind}-${r.is_active}-${r.opening_balance}-${r.holder_id}`}
          row={r}
          users={users}
          isSadmin={isSadmin}
          storeCode={storeCode}
          onSaved={() => router.refresh()}
        />
      ))}
      {isSadmin && <AccountCard row={null} users={users} isSadmin storeCode={storeCode} onSaved={() => router.refresh()} />}
    </div>
  );
}
