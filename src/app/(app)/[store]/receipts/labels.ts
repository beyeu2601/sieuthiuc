export const RECEIPT_STATUS = {
  draft: { label: "Nháp", sac: "slate" },
  confirmed: { label: "Đã nhập kho", sac: "emerald" },
  cancelled: { label: "Đã hủy", sac: "red" },
} as const;

export const PAYMENT_METHOD_LABEL = { cash: "Tiền mặt", transfer: "Chuyển khoản", other: "Khác" } as const;
