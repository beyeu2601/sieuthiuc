export const ORDER_STATUS = {
  pending: { label: "Chờ giao", variant: "outline" },
  shipped: { label: "Đang giao", variant: "default" },
  delivered: { label: "Đã giao", variant: "secondary" },
  cancelled: { label: "Đã hủy", variant: "destructive" },
  returned: { label: "Trả hàng", variant: "outline" },
} as const;

export const ONLINE_CHANNELS = { shopee: "Shopee", facebook: "Facebook", other: "Khác" } as const;
