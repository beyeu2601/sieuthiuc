export const STOCK_STATUS = {
  out: { label: "Hết hàng", variant: "destructive" },
  low: { label: "Sắp hết", variant: "outline" },
  in_stock: { label: "Còn hàng", variant: "secondary" },
} as const;

export const MOVEMENT_LABEL: Record<string, string> = {
  opening: "Tồn đầu kỳ",
  purchase: "Nhập hàng",
  sale: "Bán hàng",
  sale_return: "Trả / hủy bán",
  adjustment: "Điều chỉnh",
  writeoff: "Hủy hàng",
  count: "Kiểm kê",
  transfer_out: "Chuyển đi",
  transfer_in: "Chuyển đến",
  order_reserve: "Giữ hàng đơn online",
  order_release: "Bỏ giữ hàng",
};
