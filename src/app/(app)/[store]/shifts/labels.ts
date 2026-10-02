export const SHIFT_STATUS = {
  open: { label: "Đang mở", sac: "emerald" },
  closed: { label: "Đã chốt", sac: "amber" },
  flagged: { label: "Cần kiểm tra", sac: "red" },
  approved: { label: "Đã duyệt", sac: "brand" },
} as const;

export type ShiftSummary = {
  sales_count: number;
  cancelled_count: number;
  revenue: number;
  by_method: Partial<Record<"cash" | "transfer" | "other", number>>;
  cash_in: number;
  cash_out: number;
  expected_cash: number;
};
