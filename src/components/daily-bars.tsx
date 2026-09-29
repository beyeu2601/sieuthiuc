"use client";

import { useState } from "react";
import { formatDateVN } from "@/lib/dates";
import { formatMoney } from "@/lib/format";

// Nhan truc gon: "1,2 Tr", "350 N". So day du nam o tooltip va bang so lieu ben duoi.
const compact = new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 1 });

// Bieu do cot 1 chuoi theo ngay. Mot chuoi nen khong can chu giai; tieu de ben ngoai goi ten chuoi.
// SVG chi ve cot va duong moc, co gian theo khung (preserveAspectRatio="none"). Nhan truc la HTML
// de co chu co dinh: truoc day chu nam trong SVG nen tren dien thoai bi thu con khoang 5px.
export function DailyBars({ data, label }: { data: { day: string; value: number }[]; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (data.length === 0) return null;
  const W = 720;
  const H = 160;
  const max = Math.max(1, ...data.map((d) => d.value));
  const min = Math.min(0, ...data.map((d) => d.value));
  const range = max - min;
  const slot = W / data.length;
  const barW = Math.max(2, Math.min(28, slot - 2));
  const y = (v: number) => ((max - v) / range) * H;
  const zeroY = y(0);
  const h = hover != null ? data[hover] : null;
  const peak = data.reduce((a, b) => (b.value > a.value ? b : a), data[0]);
  // Toi da ~6 nhan ngay de khong chong nhau tren man hep
  const step = Math.ceil(data.length / 6);
  const pct = (v: number) => `${(v / H) * 100}%`;

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative h-40 w-12 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums" aria-hidden="true">
          <span className="absolute right-0 -translate-y-1/2" style={{ top: 0 }}>
            {compact.format(max)}
          </span>
          <span className="absolute right-0 -translate-y-1/2" style={{ top: pct(zeroY) }}>
            0
          </span>
          {min < 0 && (
            <span className="absolute right-0 -translate-y-1/2" style={{ top: "100%" }}>
              {compact.format(min)}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="h-40 w-full overflow-visible"
            role="img"
            aria-label={`${label} theo ngày, ${data.length} ngày. Cao nhất ${formatMoney(peak.value)} ngày ${formatDateVN(peak.day)}.`}
            onMouseLeave={() => setHover(null)}
          >
            <line x1={0} x2={W} y1={0} y2={0} className="stroke-border" strokeWidth={1} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
            <line x1={0} x2={W} y1={zeroY} y2={zeroY} className="stroke-border" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            {data.map((d, i) => {
              const x = i * slot + (slot - barW) / 2;
              const top = Math.min(y(d.value), zeroY);
              const height = Math.max(d.value === 0 ? 0 : 1, Math.abs(y(d.value) - zeroY));
              return (
                <g key={d.day}>
                  <rect x={i * slot} y={0} width={slot} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />
                  <rect
                    x={x}
                    y={top}
                    width={barW}
                    height={height}
                    className={d.value < 0 ? "fill-destructive" : "fill-primary"}
                    opacity={hover == null || hover === i ? 1 : 0.45}
                    pointerEvents="none"
                  />
                </g>
              );
            })}
          </svg>
          <div className="relative mt-1 h-4 text-[11px] text-muted-foreground" aria-hidden="true">
            {data.map((d, i) =>
              i % step === 0 ? (
                <span key={d.day} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${((i + 0.5) / data.length) * 100}%` }}>
                  {d.day.slice(8, 10)}/{d.day.slice(5, 7)}
                </span>
              ) : null
            )}
          </div>
        </div>
      </div>
      {h && (
        <div className="pointer-events-none absolute top-0 right-0 rounded-md border bg-popover px-2 py-1 text-xs shadow">
          {formatDateVN(h.day)}: <strong className="tabular-nums">{formatMoney(h.value)}</strong>
        </div>
      )}
    </div>
  );
}
