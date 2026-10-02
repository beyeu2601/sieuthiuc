// Tinh trang han tra cua khoan cong no
export const DUE = {
  overdue: { label: "Quá hạn", sac: "red" },
  due_soon: { label: "Sắp đến hạn", sac: "amber" },
  not_due: { label: "Chưa đến hạn", sac: "slate" },
  paid: { label: "Đã trả", sac: "emerald" },
} as const;
