import { requireRole } from "@/lib/auth";
import { ROLE_LABEL, type AppRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata = { title: "Cài đặt" };

type UserRow = {
  id: string;
  username: string;
  full_name: string;
  role: AppRole;
  is_active: boolean;
  user_stores: { stores: { code: string } | null }[];
};

export default async function SettingsPage() {
  const ctx = await requireRole("sadmin", "admin");
  const supabase = await createClient();

  const [{ data: stores }, { data: users }] = await Promise.all([
    supabase.from("stores").select("id, code, name, address, phone, is_active").order("code"),
    supabase
      .from("profiles")
      .select("id, username, full_name, role, is_active, user_stores(stores(code))")
      .order("username")
      .returns<UserRow[]>(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Cài đặt</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cửa hàng</CardTitle>
          <CardDescription>
            {ctx.profile.role === "sadmin"
              ? "Tất cả cửa hàng trong hệ thống."
              : "Cửa hàng bạn đang quản lý."}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã</TableHead>
                <TableHead>Tên</TableHead>
                <TableHead>Địa chỉ</TableHead>
                <TableHead>Điện thoại</TableHead>
                <TableHead>Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(stores ?? []).map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.code}</TableCell>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>{s.address ?? "-"}</TableCell>
                  <TableCell>{s.phone ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant={s.is_active ? "secondary" : "outline"}>
                      {s.is_active ? "Đang hoạt động" : "Ngừng"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Người dùng</CardTitle>
          <CardDescription>Tạo, sửa và khóa tài khoản sẽ có ở bước tiếp theo.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên đăng nhập</TableHead>
                <TableHead>Họ tên</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead>Cửa hàng</TableHead>
                <TableHead>Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(users ?? []).map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.username}</TableCell>
                  <TableCell>{u.full_name}</TableCell>
                  <TableCell>{ROLE_LABEL[u.role]}</TableCell>
                  <TableCell>
                    {u.role === "sadmin"
                      ? "Tất cả"
                      : u.user_stores.map((x) => x.stores?.code).filter(Boolean).join(", ") || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.is_active ? "secondary" : "outline"}>
                      {u.is_active ? "Hoạt động" : "Đã khóa"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
