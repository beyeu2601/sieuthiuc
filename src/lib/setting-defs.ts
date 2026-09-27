export type SettingDef = {
  key: string;
  label: string;
  kind: "number" | "money" | "text";
  help?: string;
  min?: number;
  max?: number;
};

export const GENERAL_SETTINGS: SettingDef[] = [
  { key: "inventory.default_min_stock", label: "Tồn tối thiểu mặc định", kind: "number", min: 0, help: "Dùng khi sản phẩm không đặt tồn tối thiểu riêng." },
  { key: "pricing.rounding_unit", label: "Làm tròn giá theo % Benefit (₫)", kind: "money", min: 1 },
  { key: "pos.max_manual_discount_pct", label: "Nhân viên được giảm giá tối đa (%)", kind: "number", min: 0, max: 100 },
  { key: "shift.diff_alert_amount", label: "Cảnh báo lệch tiền ca từ (₫)", kind: "money", min: 0 },
  { key: "debt.due_soon_days", label: "Nhắc công nợ trước hạn (ngày)", kind: "number", min: 0, max: 60 },
  { key: "label.size", label: "Khổ tem mã vạch (rộng x cao, mm)", kind: "text", help: "Ví dụ 40x30" },
];

// Cận date: ngưỡng theo loại date của sản phẩm và phụ thu cho giá bán đề xuất.
export const EXPIRY_SETTINGS: SettingDef[] = [
  { key: "expiry.short_date_days", label: "Date ngắn: giảm giá khi còn (ngày)", kind: "number", min: 1, max: 365, help: "Lô hàng date ngắn còn dưới số ngày này thì đề xuất giá giảm." },
  { key: "expiry.long_date_days", label: "Date dài: giảm giá khi còn (ngày)", kind: "number", min: 1, max: 365, help: "Lô hàng date dài còn dưới số ngày này thì đề xuất giá giảm." },
  { key: "expiry.markup_vnd", label: "Phụ thu cộng vào giá vốn (₫)", kind: "money", min: 0, help: "Giá bán đề xuất = giá vốn lô + số này." },
];

export const LOYALTY_SETTINGS: SettingDef[] = [
  { key: "loyalty.earn_rate_vnd", label: "Số tiền để được 1 điểm (₫)", kind: "money", min: 1 },
  { key: "loyalty.redeem_value_vnd", label: "Giá trị 1 điểm khi dùng (₫)", kind: "money", min: 1 },
  { key: "loyalty.redeem_step", label: "Dùng điểm theo bội số", kind: "number", min: 1 },
  { key: "loyalty.max_redeem_pct", label: "Dùng điểm tối đa (% giá trị đơn)", kind: "number", min: 0, max: 100 },
  { key: "loyalty.points_expiry_months", label: "Điểm hết hạn sau (tháng, 0 = không hết hạn)", kind: "number", min: 0, max: 120 },
];
