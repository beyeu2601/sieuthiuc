// Dien thoai: moi dong bang thanh mot the, so lieu co nhan de khong phai cuon ngang.
// Trang dung kem bang: bang `hidden md:block`, danh sach the `md:hidden`.
export type CardStat = { label: string; value: React.ReactNode; strong?: boolean };

export function MobileCardList({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <ul className="space-y-2 md:hidden" aria-label={label}>
      {children}
    </ul>
  );
}

export function MobileCard({
  title,
  subtitle,
  badge,
  stats,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  stats: CardStat[];
}) {
  return (
    <li className="rounded-xl border bg-card p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium">{title}</div>
          {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-x-3 gap-y-2 border-t pt-3">
        {stats.map((s) => (
          <div key={s.label} className="min-w-0">
            <dt className="truncate text-xs text-muted-foreground">{s.label}</dt>
            <dd className={s.strong ? "text-base font-semibold tabular-nums" : "text-sm tabular-nums"}>{s.value}</dd>
          </div>
        ))}
      </dl>
    </li>
  );
}
