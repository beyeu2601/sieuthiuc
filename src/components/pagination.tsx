import Link from "next/link";
import { Button } from "@/components/ui/button";

// Phan trang qua query string ?page=
export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  params,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  };
  return (
    <div className="flex items-center justify-between gap-2 py-3 text-sm text-muted-foreground">
      <span>
        {total === 0 ? "Không có dữ liệu" : `Trang ${page}/${pages} - ${new Intl.NumberFormat("vi-VN").format(total)} dòng`}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button variant="outline" size="sm" render={<Link href={href(page - 1)} />}>
            Trang trước
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Trang trước
          </Button>
        )}
        {page < pages ? (
          <Button variant="outline" size="sm" render={<Link href={href(page + 1)} />}>
            Trang sau
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Trang sau
          </Button>
        )}
      </div>
    </div>
  );
}
