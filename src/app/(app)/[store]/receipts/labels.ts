export const RECEIPT_STATUS = {
  draft: { label: "Nháp", sac: "slate" },
  confirmed: { label: "Đã nhập kho", sac: "emerald" },
  cancelled: { label: "Đã hủy", sac: "red" },
} as const;

export const PAYMENT_METHOD_LABEL = { cash: "Tiền mặt", transfer: "Chuyển khoản", other: "Khác" } as const;

export const COST_TYPE_LABEL: Record<string, string> = { shipping: "Vận chuyển", tax: "Thuế", customs: "Hải quan", other: "Khác" };
export const ALLOCATION_LABEL: Record<string, string> = { by_value: "Theo giá trị", by_qty: "Theo số lượng" };
