"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { importProducts, type ImportRow } from "../actions";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const HEADERS = ["Tên sản phẩm", "ĐVT", "Loại hàng (Cont/Air)", "Giá bán", "Nhóm hàng", "Thương hiệu", "Mã vạch", "Tồn tối thiểu", "Ghi chú"];

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[.\s,]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}
function str(v: unknown): string | null {
  const s = v == null ? "" : String(v).trim();
  return s === "" ? null : s;
}

type Parsed = { rows: ImportRow[]; errors: string[] };

export function ImportForm() {
  const router = useRouter();
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [fileName, setFileName] = useState("");
  const [pending, start] = useTransition();

  async function downloadTemplate() {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([
      HEADERS,
      ["Sữa Bột Ensure Úc 850g", "Lon", "Cont", 900000, "Sữa", "Abbott", "9300617000123", 5, ""],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SanPham");
    XLSX.writeFile(wb, "mau-import-san-pham.xlsx");
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer());
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, blankrows: false });
    const rows: ImportRow[] = [];
    const errors: string[] = [];
    data.slice(1).forEach((r, i) => {
      const rowNo = i + 2;
      if (!r.some((c) => c != null && String(c).trim() !== "")) return;
      const type = str(r[2])?.toLowerCase();
      const row: ImportRow = {
        row: rowNo,
        name: str(r[0]) ?? "",
        unit: str(r[1]) ?? "",
        goods_type: type ?? "",
        sell_price: num(r[3]),
        category: str(r[4]),
        brand: str(r[5]),
        barcode: str(r[6]),
        min_stock: num(r[7]),
        note: str(r[8]),
      };
      const errs: string[] = [];
      if (!row.name) errs.push("thiếu tên");
      if (!row.unit) errs.push("thiếu ĐVT");
      if (type !== "cont" && type !== "air") errs.push("loại hàng phải là Cont hoặc Air");
      if (row.sell_price != null && (Number.isNaN(row.sell_price) || row.sell_price < 0)) errs.push("giá bán không hợp lệ");
      if (row.min_stock != null && (Number.isNaN(row.min_stock) || row.min_stock < 0)) errs.push("tồn tối thiểu không hợp lệ");
      if (errs.length) errors.push(`Dòng ${rowNo}: ${errs.join(", ")}`);
      rows.push(row);
    });
    if (rows.length === 0) errors.push("File không có dòng dữ liệu (dòng 1 là tiêu đề).");
    setParsed({ rows, errors });
  }

  function submit() {
    if (!parsed) return;
    start(async () => {
      const res = await importProducts(parsed.rows);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Đã tạo ${res.data?.products ?? 0} sản phẩm`);
      router.push("/products");
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-background p-4 text-sm">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Tải file mẫu, điền mỗi sản phẩm một dòng. Dòng 1 là tiêu đề, giữ nguyên thứ tự cột.</li>
          <li>Bắt buộc: Tên, ĐVT, Loại hàng. Nhóm hàng và thương hiệu chưa có sẽ được tạo mới.</li>
          <li>Chọn file để xem trước. Chỉ khi không còn lỗi mới lưu được; lưu là tất cả hoặc không dòng nào.</li>
        </ol>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={downloadTemplate}>
            Tải file mẫu
          </Button>
          <label className="inline-flex h-8 cursor-pointer items-center rounded-lg border bg-background px-2.5 text-sm font-medium hover:bg-muted">
            Chọn file Excel
            <input type="file" accept=".xlsx,.xls" className="sr-only" onChange={onFile} />
          </label>
          {fileName && <span className="text-muted-foreground">{fileName}</span>}
        </div>
      </div>

      {parsed && (
        <div className="space-y-3">
          {parsed.errors.length > 0 ? (
            <div role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <p className="font-medium">Có {parsed.errors.length} lỗi, sửa file rồi chọn lại:</p>
              <ul className="mt-1 list-disc pl-5">
                {parsed.errors.slice(0, 30).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm">
              Sẵn sàng tạo <strong>{parsed.rows.length}</strong> sản phẩm. Xem trước 20 dòng đầu:
            </p>
          )}
          <div className="overflow-x-auto rounded-xl border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dòng</TableHead>
                  <TableHead>Tên</TableHead>
                  <TableHead>ĐVT</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead className="text-right">Giá bán</TableHead>
                  <TableHead>Nhóm</TableHead>
                  <TableHead>Mã vạch</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsed.rows.slice(0, 20).map((r) => (
                  <TableRow key={r.row}>
                    <TableCell>{r.row}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{r.unit}</TableCell>
                    <TableCell>{r.goods_type}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(r.sell_price)}</TableCell>
                    <TableCell>{r.category ?? "-"}</TableCell>
                    <TableCell>{r.barcode ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Button onClick={submit} disabled={pending || parsed.errors.length > 0} className="h-10">
            {pending ? "Đang lưu..." : `Tạo ${parsed.rows.length} sản phẩm`}
          </Button>
        </div>
      )}
    </div>
  );
}
