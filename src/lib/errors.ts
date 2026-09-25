// Chuyen loi Supabase/Postgres thanh thong diep tieng Viet cho nguoi dung.
type PgError = { message?: string; code?: string; hint?: string | null; details?: string | null };

const APP_CODES = new Set([
  "FORBIDDEN", "NOT_FOUND", "INVALID_STATE", "INSUFFICIENT_STOCK", "EXPIRED_LOT", "VALIDATION",
  "ALREADY_CONFIRMED", "SHIFT_NOT_OPEN", "DISCOUNT_LIMIT", "PAYMENT_MISMATCH", "DEBT_OVERPAY",
]);

export function errorMessage(err: unknown): string {
  const e = (err ?? {}) as PgError;
  if (e.hint && APP_CODES.has(e.hint) && e.message) return e.message;
  switch (e.code) {
    case "42501":
      return "Bạn không có quyền thực hiện thao tác này.";
    case "23505":
      return "Dữ liệu bị trùng với bản ghi đã có.";
    case "23503":
      return "Dữ liệu đang được tham chiếu hoặc tham chiếu không tồn tại.";
    case "23514":
    case "22P02":
      return "Dữ liệu không hợp lệ.";
    case "PGRST116":
      return "Không tìm thấy dữ liệu.";
  }
  return "Có lỗi xảy ra. Thử lại hoặc liên hệ quản trị.";
}

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
