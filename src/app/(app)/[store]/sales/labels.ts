export const SALE_STATUS = {
  draft: { label: "Nháp", sac: "slate" },
  completed: { label: "Hoàn tất", sac: "emerald" },
  cancelled: { label: "Đã hủy", sac: "red" },
  refunded: { label: "Đã hoàn trả", sac: "rose" },
  partially_refunded: { label: "Hoàn trả một phần", sac: "rose" },
} as const;

export const CHANNEL_LABEL = { pos: "Tại quầy", shopee: "Shopee", facebook: "Facebook", preorder: "Đặt trước", other: "Khác" } as const;
