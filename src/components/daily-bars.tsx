"use client";

import { useState } from "react";
import { formatDateVN } from "@/lib/dates";
import { formatMoney } from "@/lib/format";

// Bieu do cot 1 chuoi theo ngay (SVG). Mot chuoi nen khong can chu giai; tieu de ben ngoai goi ten chuoi.
export function DailyBars({ data, label }: { data: { day: string; value: number }[]; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (data.length === 0) return null;
  const W = 720;
  const H = 180;
  const padL = 4;
  const padB = 20;
  const max = Math.max(1, ...data.map((d) => d.value));
  const min = Math.min(0, ...data.map((d) => d.value));
  const range = max - min;
  const slot = (W - padL) / data.length;
  const barW = Math.max(2, Math.min(28, slot - 2));
  const y = (v: number) => ((max - v) / range) * (H - padB);
  const zeroY = y(0);
  const h = hover != null ? data[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full" role="img" aria-label={`${label} theo ngày`} onMouseLeave={() => setHover(null)}>
        <line x1={0} x2={W} y1={zeroY} y2={zeroY} className="stroke-border" strokeWidth={1} />
        {data.map((d, i) => {
          const x = padL + i * slot + (slot - barW) / 2;
          const top = Math.min(y(d.value), zeroY);
          const height = Math.max(d.value === 0 ? 0 : 1, Math.abs(y(d.value) - zeroY));
          return (
            <g key={d.day}>
              <rect
                x={padL + i * slot}
                y={0}
                width={slot}
                height={H - padB}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
              />
              <rect
                x={x}
                y={top}
                width={barW}
                height={height}
                rx={Math.min(4, barW / 2)}
                className={d.value < 0 ? "fill-red-600" : "fill-primary"}
                opacity={hover == null || hover === i ? 1 : 0.45}
                pointerEvents="none"
              />
            </g>
          );
        })}
        {data.length <= 31 &&
          data.map((d, i) =>
            i % Math.ceil(data.length / 8) === 0 ? (
              <text key={d.day} x={padL + i * slot + slot / 2} y={H - 4} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                {d.day.slice(8, 10)}/{d.day.slice(5, 7)}
              </text>
            ) : null
          )}
      </svg>
      {h && (
        <div className="pointer-events-none absolute top-0 right-0 rounded-md border bg-popover px-2 py-1 text-xs shadow">
          {formatDateVN(h.day)}: <strong className="tabular-nums">{formatMoney(h.value)}</strong>
        </div>
      )}
    </div>
  );
}
