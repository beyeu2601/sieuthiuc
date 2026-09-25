"use client";

import { useState } from "react";
import Link from "next/link";
import { AutoSubmitForm } from "@/components/auto-submit-form";
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

export function ReportFilter(props: {
  basePath: string;
  preset?: string;
  from: string;
  to: string;
  channel?: string;
  showChannel?: boolean;
  allStores?: boolean;
  canAllStores?: boolean;
  extra?: React.ReactNode;
  // tham so rieng cua trang (nhom theo, xep theo) giu lai khi bam ky nhanh
  keep?: Record<string, string | undefined>;
}) {
  // doi ky thi dung form moi de o ngay va trang thai mo/dong theo ky moi
  return <FilterBody key={`${props.preset}-${props.from}-${props.to}`} {...props} />;
}

function FilterBody({
  basePath,
  preset,
  from,
  to,
  channel,
  showChannel,
  allStores,
  canAllStores,
  extra,
  keep,
}: React.ComponentProps<typeof ReportFilter>) {
  const [custom, setCustom] = useState(!preset);
  const href = (p: Record<string, string>) => {
    const sp = new URLSearchParams(p);
    if (channel) sp.set("channel", channel);
    if (allStores) sp.set("all", "1");
    for (const [k, v] of Object.entries(keep ?? {})) if (v) sp.set(k, v);
    return `${basePath}?${sp.toString()}`;
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Chọn kỳ nhanh">
        {PRESETS.map((p) => (
          <Link
            key={p.k}
            href={href({ preset: p.k })}
            aria-current={preset === p.k ? "true" : undefined}
            className={cn(
              "inline-flex h-10 items-center rounded-lg border px-3.5 text-sm",
              preset === p.k ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"
            )}
          >
            {p.label}
          </Link>
        ))}
      </div>
      <AutoSubmitForm action={basePath} className="space-y-2">
        {!custom && preset && <input type="hidden" name="preset" value={preset} />}
        <details open={custom} onToggle={(e) => setCustom(e.currentTarget.open)} className="rounded-lg border bg-card">
          <summary className="flex h-10 cursor-pointer items-center px-3 text-sm">Chọn ngày khác</summary>
          <div className="grid grid-cols-2 gap-2 px-3 pb-3 sm:flex sm:items-end">
            <label className="block min-w-0 space-y-1 text-sm">
              Từ ngày
              <Input type="date" name="from" defaultValue={from} disabled={!custom} className="min-w-0" />
            </label>
            <label className="block min-w-0 space-y-1 text-sm">
              Đến ngày
              <Input type="date" name="to" defaultValue={to} disabled={!custom} className="min-w-0" />
            </label>
            <Button type="submit" variant="secondary" className="col-span-2 h-10">
              Xem
            </Button>
          </div>
        </details>
        {(showChannel || canAllStores || extra) && (
          <div className="grid grid-cols-2 items-end gap-2 sm:flex sm:flex-wrap">
            {showChannel && (
              <label className="block space-y-1 text-sm">
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
              <label className="flex h-10 items-center gap-2 text-sm">
                <input type="checkbox" name="all" value="1" defaultChecked={allStores} className="size-5" />
                Tất cả cửa hàng
              </label>
            )}
            {extra}
          </div>
        )}
      </AutoSubmitForm>
    </div>
  );
}
