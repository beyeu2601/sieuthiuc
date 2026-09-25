export const SALE_STATUS = {
  draft: { label: "Nháp", variant: "outline" },
  completed: { label: "Hoàn tất", variant: "secondary" },
  cancelled: { label: "Đã hủy", variant: "destructive" },
  refunded: { label: "Đã hoàn trả", variant: "outline" },
  partially_refunded: { label: "Hoàn trả một phần", variant: "outline" },
} as const;

export const CHANNEL_LABEL = { pos: "Tại quầy", shopee: "Shopee", facebook: "Facebook", other: "Khác" } as const;
