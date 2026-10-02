export const TRANSFER_STATUS = {
  draft: { label: "Nháp", sac: "slate" },
  sent: { label: "Đang chuyển", sac: "amber" },
  received: { label: "Đã nhận", sac: "emerald" },
  cancelled: { label: "Đã hủy", sac: "red" },
} as const;
