"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createUser, resetUserPassword, updateUser, type UserInput } from "../actions";
import { ROLE_LABEL, type AppRole, type StoreLite } from "@/lib/roles";
import { NativeSelect } from "@/components/native-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type UserRow = {
  id: string;
  username: string;
  full_name: string;
  phone: string | null;
  role: AppRole;
  is_active: boolean;
  default_store_id: string | null;
  confirm_receipt: boolean;
  store_ids: string[];
};

type Mode = { kind: "create" } | { kind: "edit"; user: UserRow } | { kind: "password"; user: UserRow } | null;

export function UserManager({
  users,
  stores,
  myRole,
  myId,
}: {
  users: UserRow[];
  stores: StoreLite[];
  myRole: AppRole;
  myId: string;
}) {
  const [mode, setMode] = useState<Mode>(null);
  const storeCode = new Map(stores.map((s) => [s.id, s.code]));
  const canManage = (u: UserRow) =>
    myRole === "sadmin" || (["accountant", "staff"].includes(u.role) && u.store_ids.every((s) => storeCode.has(s)));

  return (
    <div className="space-y-3">
      <div className="flex justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Người dùng đăng nhập bằng tên đăng nhập và mật khẩu. Khóa tài khoản sẽ đăng xuất người đó ngay.
        </p>
        <Button onClick={() => setMode({ kind: "create" })}>Thêm người dùng</Button>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tên đăng nhập</TableHead>
              <TableHead>Họ tên</TableHead>
              <TableHead>Vai trò</TableHead>
              <TableHead>Cửa hàng</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.username}</TableCell>
                <TableCell>
                  {u.full_name}
                  {u.phone && <div className="text-xs text-muted-foreground">{u.phone}</div>}
                </TableCell>
                <TableCell>
                  {ROLE_LABEL[u.role]}
                  {u.confirm_receipt && u.role === "staff" && (
                    <div className="text-xs text-muted-foreground">Được xác nhận phiếu nhập</div>
                  )}
                </TableCell>
                <TableCell>
                  {u.role === "sadmin" ? "Tất cả" : u.store_ids.map((s) => storeCode.get(s) ?? "?").join(", ") || "-"}
                </TableCell>
                <TableCell>
                  <Badge variant={u.is_active ? "secondary" : "outline"}>{u.is_active ? "Hoạt động" : "Đã khóa"}</Badge>
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {canManage(u) && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setMode({ kind: "edit", user: u })}>
                        Sửa
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setMode({ kind: "password", user: u })}>
                        Đặt mật khẩu
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={mode != null} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent className="sm:max-w-lg">
          {mode?.kind === "create" && (
            <UserForm stores={stores} myRole={myRole} myId={myId} onDone={() => setMode(null)} />
          )}
          {mode?.kind === "edit" && (
            <UserForm stores={stores} myRole={myRole} myId={myId} user={mode.user} onDone={() => setMode(null)} />
          )}
          {mode?.kind === "password" && <PasswordForm user={mode.user} onDone={() => setMode(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UserForm({
  stores,
  myRole,
  myId,
  user,
  onDone,
}: {
  stores: StoreLite[];
  myRole: AppRole;
  myId: string;
  user?: UserRow;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [v, setV] = useState<UserInput>({
    username: user?.username ?? "",
    full_name: user?.full_name ?? "",
    phone: user?.phone ?? null,
    role: user?.role ?? "staff",
    store_ids: user?.store_ids ?? (stores.length === 1 ? [stores[0].id] : []),
    default_store_id: user?.default_store_id ?? null,
    is_active: user?.is_active ?? true,
    confirm_receipt: user?.confirm_receipt ?? false,
    password: "",
  });
  const roles: AppRole[] = myRole === "sadmin" ? ["sadmin", "admin", "accountant", "staff"] : ["accountant", "staff"];
  const isSelf = user?.id === myId;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = user ? await updateUser(user.id, v) : await createUser(v);
      if (!res.ok) return void setError(res.error);
      toast.success(user ? "Đã lưu người dùng" : "Đã tạo người dùng");
      onDone();
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <DialogHeader>
        <DialogTitle>{user ? `Sửa ${user.username}` : "Thêm người dùng"}</DialogTitle>
        <DialogDescription>
          {user ? "Tên đăng nhập không đổi được." : "Gửi tên đăng nhập và mật khẩu cho người dùng sau khi tạo."}
        </DialogDescription>
      </DialogHeader>
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="u-username">Tên đăng nhập *</Label>
          <Input
            id="u-username"
            value={v.username}
            disabled={!!user}
            autoCapitalize="none"
            autoComplete="off"
            onChange={(e) => setV({ ...v, username: e.target.value.toLowerCase().replace(/\s/g, "") })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="u-name">Họ tên *</Label>
          <Input id="u-name" value={v.full_name} onChange={(e) => setV({ ...v, full_name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="u-phone">Điện thoại</Label>
          <Input id="u-phone" type="tel" value={v.phone ?? ""} onChange={(e) => setV({ ...v, phone: e.target.value || null })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="u-role">Vai trò *</Label>
          <NativeSelect
            id="u-role"
            value={v.role}
            disabled={isSelf}
            onChange={(e) => setV({ ...v, role: e.target.value as AppRole })}
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </NativeSelect>
        </div>
        {!user && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="u-pass">Mật khẩu *</Label>
            <Input
              id="u-pass"
              type="text"
              autoComplete="new-password"
              value={v.password ?? ""}
              onChange={(e) => setV({ ...v, password: e.target.value })}
              placeholder="Tối thiểu 8 ký tự"
            />
          </div>
        )}
        {v.role !== "sadmin" && (
          <div className="space-y-1.5 sm:col-span-2">
            <span className="text-sm font-medium">Cửa hàng *</span>
            <div className="flex flex-wrap gap-3">
              {stores.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={v.store_ids.includes(s.id)}
                    onChange={(e) =>
                      setV({
                        ...v,
                        store_ids: e.target.checked ? [...v.store_ids, s.id] : v.store_ids.filter((x) => x !== s.id),
                      })
                    }
                  />
                  {s.code} - {s.name}
                </label>
              ))}
            </div>
          </div>
        )}
        {v.role === "staff" && (
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              className="size-4"
              checked={v.confirm_receipt}
              onChange={(e) => setV({ ...v, confirm_receipt: e.target.checked })}
            />
            Cho phép xác nhận phiếu nhập hàng
          </label>
        )}
        {user && !isSelf && (
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              className="size-4"
              checked={v.is_active}
              onChange={(e) => setV({ ...v, is_active: e.target.checked })}
            />
            Tài khoản đang hoạt động (bỏ chọn để khóa)
          </label>
        )}
      </fieldset>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Hủy
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Đang lưu..." : "Lưu"}
        </Button>
      </div>
    </form>
  );
}

function PasswordForm({ user, onDone }: { user: UserRow; onDone: () => void }) {
  const [pw, setPw] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await resetUserPassword(user.id, user.role, user.store_ids, pw);
      if (!res.ok) return void setError(res.error);
      toast.success(`Đã đặt mật khẩu mới cho ${user.username}`);
      onDone();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <DialogHeader>
        <DialogTitle>Đặt mật khẩu mới</DialogTitle>
        <DialogDescription>Cho tài khoản {user.username}. Báo mật khẩu mới trực tiếp cho người dùng.</DialogDescription>
      </DialogHeader>
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="new-pw">Mật khẩu mới</Label>
        <Input id="new-pw" type="text" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Hủy
        </Button>
        <Button type="submit" disabled={pending || pw.length < 8}>
          Đặt mật khẩu
        </Button>
      </div>
    </form>
  );
}
