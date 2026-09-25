export const RECEIPT_STATUS = {
  draft: { label: "Nháp", variant: "outline" },
  confirmed: { label: "Đã nhập kho", variant: "secondary" },
  cancelled: { label: "Đã hủy", variant: "destructive" },
} as const;

export const PAYMENT_METHOD_LABEL = { cash: "Tiền mặt", transfer: "Chuyển khoản", other: "Khác" } as const;
