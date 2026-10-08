"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { applyPriceSuggestions } from "../actions";
import { formatMoney } from "@/lib/format";
import { GOODS_TYPE_LABEL } from "@/lib/text";
import { ChipSac, sacLoaiHang } from "@/components/ui/chip";
import { MobileCard, MobileCardList } from "@/components/mobile-card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type Suggestion = {
  product_id: string;
  sku: string;
  name: string;
  goods_type: "cont" | "air";
  cost_price_ref: number;
  benefit_pct: number;
  current_price: number;
  suggested_price: number;
};

export function SuggestionTable({ rows }: { rows: Suggestion[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(rows.map((r) => r.product_id)));
  const [pending, start] = useTransition();
  const all = selected.size === rows.length;

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function apply() {
    start(async () => {
      const res = await applyPriceSuggestions([...selected]);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Đã cập nhật giá ${res.data?.count ?? 0} sản phẩm`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <label className="flex min-h-11 items-center gap-2 text-sm md:hidden">
        <input
          type="checkbox"
          className="size-5"
          checked={all}
          onChange={() => setSelected(all ? new Set() : new Set(rows.map((r) => r.product_id)))}
        />
        Chọn tất cả ({rows.length})
      </label>
      <MobileCardList label="Gợi ý giá">
        {rows.map((r) => {
          const diff = r.suggested_price - r.current_price;
          return (
            <MobileCard
              key={r.product_id}
              title={
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-5 shrink-0"
                    checked={selected.has(r.product_id)}
                    onChange={() => toggle(r.product_id)}
                  />
                  <span>{r.name}</span>
                </label>
              }
              subtitle={r.sku}
              badge={<ChipSac sac={sacLoaiHang(r.goods_type)}>{GOODS_TYPE_LABEL[r.goods_type]}</ChipSac>}
              stats={[
                { label: "Giá hiện tại", value: formatMoney(r.current_price) },
                { label: "Giá gợi ý", value: formatMoney(r.suggested_price), strong: true },
                {
                  label: "Chênh lệch",
                  value: (
                    <span className={diff > 0 ? "text-success" : "text-destructive"}>
                      {diff > 0 ? "+" : ""}
                      {formatMoney(diff)}
                    </span>
                  ),
                },
                { label: "Giá vốn TC", value: formatMoney(r.cost_price_ref) },
                { label: "% Benefit", value: `${r.benefit_pct}%` },
              ]}
            />
          );
        })}
      </MobileCardList>
      <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  aria-label="Chọn tất cả"
                  className="size-4"
                  checked={all}
                  onChange={() => setSelected(all ? new Set() : new Set(rows.map((r) => r.product_id)))}
                />
              </TableHead>
              <TableHead>Sản phẩm</TableHead>
              <TableHead className="text-right">Giá vốn TC</TableHead>
              <TableHead className="text-right">% Benefit</TableHead>
              <TableHead className="text-right">Giá hiện tại</TableHead>
              <TableHead className="text-right">Giá gợi ý</TableHead>
              <TableHead className="text-right">Chênh lệch</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const diff = r.suggested_price - r.current_price;
              return (
                <TableRow key={r.product_id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      className="size-4"
                      aria-label={`Chọn ${r.name}`}
                      checked={selected.has(r.product_id)}
                      onChange={() => toggle(r.product_id)}
                    />
                  </TableCell>
                  <TableCell className="min-w-56 whitespace-normal">
                    {r.name}
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      {r.sku}
                      <ChipSac sac={sacLoaiHang(r.goods_type)}>{GOODS_TYPE_LABEL[r.goods_type]}</ChipSac>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(r.cost_price_ref)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.benefit_pct}%</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(r.current_price)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatMoney(r.suggested_price)}</TableCell>
                  <TableCell className={`text-right tabular-nums ${diff > 0 ? "text-success" : "text-destructive"}`}>
                    {diff > 0 ? "+" : ""}
                    {formatMoney(diff)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 rounded-xl border bg-card/95 p-3 backdrop-blur lg:bottom-0">
        <Button onClick={apply} disabled={pending || selected.size === 0} className="h-10">
          {pending ? "Đang cập nhật..." : `Áp dụng giá mới cho ${selected.size} sản phẩm`}
        </Button>
      </div>
    </div>
  );
}
