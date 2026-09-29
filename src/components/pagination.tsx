import Link from "next/link";
import { ChevronsLeftIcon, ChevronsRightIcon } from "lucide-react";
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
  params: Record<string, string | string[] | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (Array.isArray(v)) for (const item of v) sp.append(k, item);
      else if (v) sp.set(k, v);
    }
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  };
  // Nut bi khoa van giu cho de hang nut khong nhay khi sang trang dau/cuoi
  const nav = (target: number, enabled: boolean, content: React.ReactNode, label?: string) =>
    enabled ? (
      <Button variant="outline" size={label ? "icon-sm" : "sm"} aria-label={label} title={label} render={<Link href={href(target)} />}>
        {content}
      </Button>
    ) : (
      <Button variant="outline" size={label ? "icon-sm" : "sm"} aria-label={label} disabled>
        {content}
      </Button>
    );
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm text-muted-foreground">
      <span>
        {total === 0 ? "Không có dữ liệu" : `Trang ${page}/${pages} - ${new Intl.NumberFormat("vi-VN").format(total)} dòng`}
      </span>
      <div className="flex gap-2">
        {nav(1, page > 1, <ChevronsLeftIcon />, "Trang đầu")}
        {nav(page - 1, page > 1, "Trang trước")}
        {nav(page + 1, page < pages, "Trang sau")}
        {nav(pages, page < pages, <ChevronsRightIcon />, "Trang cuối")}
      </div>
    </div>
  );
}
