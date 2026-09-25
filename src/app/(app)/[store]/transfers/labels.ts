export const TRANSFER_STATUS = {
  draft: { label: "Nháp", variant: "outline" },
  sent: { label: "Đang chuyển", variant: "default" },
  received: { label: "Đã nhận", variant: "secondary" },
  cancelled: { label: "Đã hủy", variant: "destructive" },
} as const;
