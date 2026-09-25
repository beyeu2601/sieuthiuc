"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveReconNote } from "./actions";
import { formatMoney } from "@/lib/format";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function BankCell({
  storeCode,
  storeId,
  day,
  bank,
  note,
}: {
  storeCode: string;
  storeId: string;
  day: string;
  bank: number | null;
  note: string | null;
}) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [b, setB] = useState<number | null>(bank);
  const [n, setN] = useState(note ?? "");
  const [pending, start] = useTransition();
  if (!edit)
    return (
      <button type="button" onClick={() => setEdit(true)} className="w-full rounded-md px-1 py-1 text-left hover:bg-muted">
        <span className="tabular-nums">{bank == null ? "Nhập sao kê" : formatMoney(bank)}</span>
        {note && <span className="block text-xs text-muted-foreground">{note}</span>}
      </button>
    );
  return (
    <div className="flex min-w-60 flex-col gap-1">
      <MoneyInput aria-label="Số tiền sao kê" value={b} onChange={setB} className="h-8" />
      <Input aria-label="Ghi chú xử lý" placeholder="Ghi chú" value={n} onChange={(e) => setN(e.target.value)} className="h-8" />
      <div className="flex gap-1">
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await saveReconNote(storeCode, storeId, day, b, n);
              if (!res.ok) return void toast.error(res.error);
              setEdit(false);
              router.refresh();
            })
          }
        >
          Lưu
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEdit(false)}>
          Hủy
        </Button>
      </div>
    </div>
  );
}
