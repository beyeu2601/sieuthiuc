export const ORDER_STATUS = {
  pending: { label: "Chờ giao", sac: "indigo" },
  shipped: { label: "Đang giao", sac: "sky" },
  delivered: { label: "Đã giao", sac: "emerald" },
  cancelled: { label: "Đã hủy", sac: "red" },
  returned: { label: "Hoàn hàng", sac: "rose" },
} as const;

export const ONLINE_CHANNELS = { shopee: "Shopee", facebook: "Facebook", other: "Khác" } as const;

export const RETURN_STATUS = {
  pending_check: "Chờ quản lý kiểm hàng",
  restocked: "Đã nhập lại kho",
  discarded: "Không nhập kho (hàng hỏng)",
} as const;
