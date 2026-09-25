// Ngay theo gio Viet Nam, dang yyyy-MM-dd
export function todayVN() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
}

export function addDaysISO(d: string, n: number) {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

export function diffDays(from: string, to: string) {
  return Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86400000);
}

export type Period = { from: string; to: string };

export function presetPeriod(preset: string | undefined): Period {
  const t = todayVN();
  switch (preset) {
    case "yesterday":
      return { from: addDaysISO(t, -1), to: addDaysISO(t, -1) };
    case "week": {
      const dow = (new Date(`${t}T00:00:00Z`).getUTCDay() + 6) % 7;
      return { from: addDaysISO(t, -dow), to: t };
    }
    case "month":
      return { from: `${t.slice(0, 8)}01`, to: t };
    case "last_month": {
      const first = `${t.slice(0, 8)}01`;
      const lastEnd = addDaysISO(first, -1);
      return { from: `${lastEnd.slice(0, 8)}01`, to: lastEnd };
    }
    case "quarter": {
      const m = Number(t.slice(5, 7));
      const qStart = String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, "0");
      return { from: `${t.slice(0, 4)}-${qStart}-01`, to: t };
    }
    default:
      return { from: t, to: t };
  }
}

// Ky truoc cung do dai, ket thuc ngay truoc ky hien tai
export function previousPeriod(p: Period): Period {
  const len = diffDays(p.from, p.to);
  const to = addDaysISO(p.from, -1);
  return { from: addDaysISO(to, -len), to };
}

export function formatDateVN(d: string | null | undefined) {
  if (!d) return "-";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
}
