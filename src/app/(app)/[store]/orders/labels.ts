export const ORDER_STATUS = {
  pending: { label: "Chờ giao", variant: "outline" },
  shipped: { label: "Đang giao", variant: "default" },
  delivered: { label: "Đã giao", variant: "secondary" },
  cancelled: { label: "Đã hủy", variant: "destructive" },
  returned: { label: "Hoàn hàng", variant: "outline" },
} as const;

export const ONLINE_CHANNELS = { shopee: "Shopee", facebook: "Facebook", other: "Khác" } as const;

export const RETURN_STATUS = {
  pending_check: "Chờ quản lý kiểm hàng",
  restocked: "Đã nhập lại kho",
  discarded: "Không nhập kho (hàng hỏng)",
} as const;
