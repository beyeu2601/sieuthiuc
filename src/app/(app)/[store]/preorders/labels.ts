export const PREORDER_STATUS = {
  open: { label: "Chờ hàng", sac: "indigo" },
  arrived: { label: "Hàng đã về", sac: "sky" },
  delivered: { label: "Đã giao", sac: "emerald" },
  cancelled: { label: "Đã hủy", sac: "red" },
} as const;

export type PreorderStatus = keyof typeof PREORDER_STATUS;

export type MoneyAccount = { id: string; name: string; kind: string };

export function accountLabel(a: MoneyAccount) {
  return a.kind === "cash" ? `${a.name} (tiền mặt)` : a.name;
}
