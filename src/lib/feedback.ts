import { toast } from "sonner";
import { errorMessage, type ActionResult } from "@/lib/errors";

// Chuan hoa thong bao toast: mot cho quyet dinh cach bao thanh cong / loi cho ca
// app, thay vi moi handler tu ghep `toast.success` / `toast.error`.

export function baoThanhCong(message: string) {
  toast.success(message);
}

export function baoCanhBao(message: string) {
  toast.warning(message);
}

/** Bao loi tu bat ky nguon nao (Error, PgError, ActionResult that bai...). */
export function baoLoi(err: unknown) {
  if (typeof err === "string") return void toast.error(err);
  toast.error(errorMessage(err));
}

/**
 * Xu ly ket qua cua mot server action: that bai thi bao loi, thanh cong thi bao
 * `thanhCong`. Tra ve true khi thanh cong de cho goi lam tiep (router.refresh...).
 */
export function baoTheoKetQua<T>(
  res: ActionResult<T>,
  thanhCong: string,
): res is { ok: true; data?: T } {
  if (!res.ok) {
    toast.error(res.error);
    return false;
  }
  toast.success(thanhCong);
  return true;
}
