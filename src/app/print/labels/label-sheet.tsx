"use client";

import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { formatMoney } from "@/lib/format";

export type LabelItem = { id: string; name: string; price: number; barcode: string };

function Barcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const format = /^\d{13}$/.test(value) ? "EAN13" : "CODE128";
    try {
      JsBarcode(ref.current, value, { format, height: 32, width: 1.4, fontSize: 11, margin: 0 });
    } catch {
      JsBarcode(ref.current, value, { format: "CODE128", height: 32, width: 1.2, fontSize: 11, margin: 0 });
    }
  }, [value]);
  return <svg ref={ref} className="max-w-full" />;
}

export function LabelSheet({ items, widthMm, heightMm }: { items: LabelItem[]; widthMm: number; heightMm: number }) {
  const [copies, setCopies] = useState(1);
  const list = items.flatMap((it) => Array.from({ length: copies }, (_, i) => ({ ...it, key: `${it.id}-${i}` })));

  return (
    <div>
      <style>{`@page { size: ${widthMm}mm ${heightMm}mm; margin: 0 } @media print { .no-print { display: none } body { background: white } }`}</style>
      <div className="no-print flex flex-wrap items-center gap-3 border-b p-4">
        <span className="font-medium">In tem {items.length} sản phẩm - khổ {widthMm}x{heightMm} mm</span>
        <label className="flex items-center gap-2 text-sm">
          Số tem mỗi sản phẩm
          <input
            type="number"
            min={1}
            max={200}
            value={copies}
            onChange={(e) => setCopies(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
            className="h-9 w-20 rounded-lg border px-2"
          />
        </label>
        <button onClick={() => window.print()} className="h-9 rounded-lg bg-primary px-4 text-sm text-primary-foreground">
          In
        </button>
      </div>
      {items.length === 0 && <p className="p-4 text-sm">Không có sản phẩm để in.</p>}
      <div className="flex flex-wrap gap-2 p-4 print:block print:p-0">
        {list.map((it) => (
          <div
            key={it.key}
            className="flex flex-col items-center justify-between overflow-hidden border bg-white p-1 text-black print:border-0"
            style={{ width: `${widthMm}mm`, height: `${heightMm}mm`, breakAfter: "page" }}
          >
            <div className="line-clamp-2 w-full text-center text-[9px] leading-tight">{it.name}</div>
            <Barcode value={it.barcode} />
            <div className="text-[11px] font-bold">{formatMoney(it.price)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
