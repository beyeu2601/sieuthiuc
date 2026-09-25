export const SHIFT_STATUS = {
  open: { label: "Đang mở", variant: "default" },
  closed: { label: "Đã chốt", variant: "secondary" },
  flagged: { label: "Cần kiểm tra", variant: "destructive" },
  approved: { label: "Đã duyệt", variant: "outline" },
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
