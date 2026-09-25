import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/native-select";
import { cn } from "@/lib/utils";

const PRESETS = [
  { k: "today", label: "Hôm nay" },
  { k: "yesterday", label: "Hôm qua" },
  { k: "week", label: "Tuần này" },
  { k: "month", label: "Tháng này" },
  { k: "last_month", label: "Tháng trước" },
  { k: "quarter", label: "Quý này" },
];

export function ReportFilter({
  basePath,
  preset,
  from,
  to,
  channel,
  showChannel,
  allStores,
  canAllStores,
  extra,
}: {
  basePath: string;
  preset?: string;
  from: string;
  to: string;
  channel?: string;
  showChannel?: boolean;
  allStores?: boolean;
  canAllStores?: boolean;
  extra?: React.ReactNode;
}) {
  const keep = (p: Record<string, string>) => {
    const sp = new URLSearchParams(p);
    if (channel) sp.set("channel", channel);
    if (allStores) sp.set("all", "1");
    return `${basePath}?${sp.toString()}`;
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1" role="group" aria-label="Chọn kỳ nhanh">
        {PRESETS.map((p) => (
          <Link
            key={p.k}
            href={keep({ preset: p.k })}
            className={cn(
              "inline-flex h-8 items-center rounded-lg border px-3 text-sm",
              preset === p.k ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
            )}
          >
            {p.label}
          </Link>
        ))}
      </div>
      <form className="flex flex-wrap items-end gap-2">
        <label className="space-y-1 text-sm">
          Từ ngày
          <Input type="date" name="from" defaultValue={from} />
        </label>
        <label className="space-y-1 text-sm">
          Đến ngày
          <Input type="date" name="to" defaultValue={to} />
        </label>
        {showChannel && (
          <label className="space-y-1 text-sm">
            Kênh
            <NativeSelect name="channel" defaultValue={channel ?? ""}>
              <option value="">Mọi kênh</option>
              <option value="pos">Tại quầy</option>
              <option value="shopee">Shopee</option>
              <option value="facebook">Facebook</option>
              <option value="other">Khác</option>
            </NativeSelect>
          </label>
        )}
        {canAllStores && (
          <label className="flex h-9 items-center gap-2 text-sm">
            <input type="checkbox" name="all" value="1" defaultChecked={allStores} className="size-4" />
            Tất cả cửa hàng
          </label>
        )}
        {extra}
        <Button type="submit" variant="secondary">
          Xem
        </Button>
      </form>
    </div>
  );
}
