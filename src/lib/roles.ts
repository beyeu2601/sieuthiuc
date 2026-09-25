// Dung duoc ca o client va server.
export type AppRole = "sadmin" | "admin" | "accountant" | "staff";

export const ROLE_LABEL: Record<AppRole, string> = {
  sadmin: "Quản trị hệ thống",
  admin: "Quản lý cửa hàng",
  accountant: "Kế toán",
  staff: "Nhân viên",
};

export const USERNAME_RE = /^[a-z0-9._]{3,32}$/;

// Supabase Auth bat buoc email; he thong dung email noi bo, nguoi dung chi thay username.
export function usernameToEmail(username: string) {
  return `${username.trim().toLowerCase()}@sieuthiuc.local`;
}

export type StoreLite = { id: string; code: string; name: string };
