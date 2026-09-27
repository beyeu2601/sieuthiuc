"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { PrinterIcon } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";

// Ve ma vach ngay tren trang, dung cung cach voi trang in tem (/print/labels)
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

export function LabelPreview({
  productId,
  name,
  price,
  barcode,
  sku,
  hasBarcode,
  widthMm,
  heightMm,
}: {
  productId: string;
  name: string;
  price: number;
  barcode: string;
  sku: string;
  hasBarcode: boolean;
  widthMm: number;
  heightMm: number;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Xem trước tem sẽ in ra. Tem lấy <strong>tên sản phẩm</strong>, <strong>mã chính</strong> và{" "}
        <strong>giá bán hiện tại</strong>. Bấm In tem để in ra máy (chọn được số lượng tem mỗi sản phẩm).
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <div
          className="flex shrink-0 flex-col items-center justify-between overflow-hidden rounded-sm border bg-white p-[2mm] text-black shadow-sm"
          style={{ width: `${widthMm}mm`, height: `${heightMm}mm` }}
        >
          <div className="line-clamp-2 w-full text-center text-[9px] leading-tight">{name}</div>
          <Barcode value={barcode} />
          <div className="text-[11px] font-bold">{formatMoney(price)}</div>
        </div>
        <div className="space-y-2 text-sm">
          <div className="text-muted-foreground">
            Khổ tem {widthMm}x{heightMm} mm
          </div>
          {!hasBarcode && (
            <p className="max-w-xs rounded-lg bg-muted px-3 py-2 text-xs">
              Sản phẩm chưa có mã vạch nên tem đang in tạm mã SKU <span className="font-mono">{sku}</span>. Nên bấm
              &quot;Sinh mã nội bộ&quot; ở phần Mã vạch để quét được ở quầy.
            </p>
          )}
          <Button variant="outline" render={<Link href={`/print/labels?ids=${productId}`} target="_blank" />}>
            <PrinterIcon /> In tem
          </Button>
        </div>
      </div>
    </div>
  );
}
