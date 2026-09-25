const vnd = new Intl.NumberFormat("vi-VN");

export function formatMoney(v: number | null | undefined) {
  if (v == null) return "-";
  return `${vnd.format(Math.round(v))} ₫`;
}

export function formatNumber(v: number | null | undefined) {
  if (v == null) return "-";
  return vnd.format(v);
}

export function formatDateTime(v: string | Date | null | undefined) {
  if (!v) return "-";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(v));
}
