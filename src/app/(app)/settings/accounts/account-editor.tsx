"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveMoneyAccount, type MoneyAccountInput } from "../actions";
import { formatMoney } from "@/lib/format";
import { MoneyInput } from "@/components/money-input";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Row = {
  id: string;
  name: string;
  kind: "cash" | "bank" | "ewallet" | "other";
  is_active: boolean;
  opening_balance: number;
  balance: number;
};

export const KIND_LABEL: Record<Row["kind"], string> = {
  cash: "Tiền mặt",
  bank: "Ngân hàng",
  ewallet: "Ví điện tử",
  other: "Khác",
};

function AccountRow({ row, onSaved }: { row: Row | null; onSaved: () => void }) {
  const [name, setName] = useState(row?.name ?? "");
  const [kind, setKind] = useState<Row["kind"]>(row?.kind ?? "cash");
  const [opening, setOpening] = useState<number | null>(row?.opening_balance ?? null);
  const [active, setActive] = useState(row?.is_active ?? true);
  const [pending, start] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const input: MoneyAccountInput = {
        id: row?.id ?? null,
        name,
        kind,
        opening_balance: opening ?? 0,
        is_active: active,
        note: null,
      };
      const res = await saveMoneyAccount(input);
      if (!res.ok) return void toast.error(res.error);
      toast.success(row ? "Đã lưu tài khoản" : "Đã thêm tài khoản");
      if (!row) {
        setName("");
        setOpening(null);
      }
      onSaved();
    });
  }

  return (
    <form onSubmit={save} className="flex flex-wrap items-center gap-2 py-2">
      <Input
        aria-label="Tên tài khoản"
        placeholder={row ? "" : "Tên tài khoản mới"}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="min-w-40 flex-1"
      />
      <NativeSelect aria-label="Loại" value={kind} onChange={(e) => setKind(e.target.value as Row["kind"])} className="w-32">
        {Object.entries(KIND_LABEL).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </NativeSelect>
      <label className="text-xs text-muted-foreground">
        Số dư đầu
        <MoneyInput aria-label="Số dư đầu" value={opening} onChange={setOpening} className="h-9 w-32" />
      </label>
      {row && (
        <>
          <span className="w-32 text-right text-sm tabular-nums" title="Số dư hiện tại">
            {formatMoney(row.balance)}
          </span>
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" className="size-4" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Dùng
          </label>
        </>
      )}
      <Button type="submit" size="sm" variant={row ? "outline" : "default"} disabled={pending || !name.trim()}>
        {row ? "Lưu" : "Thêm"}
      </Button>
    </form>
  );
}

export function AccountEditor({ rows }: { rows: Row[] }) {
  const router = useRouter();
  return (
    <div className="divide-y">
      <AccountRow row={null} onSaved={() => router.refresh()} />
      {rows.map((r) => (
        <AccountRow key={`${r.id}-${r.name}-${r.is_active}-${r.opening_balance}`} row={r} onSaved={() => router.refresh()} />
      ))}
    </div>
  );
}
