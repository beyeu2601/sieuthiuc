import { requireRole } from "@/lib/auth";
import { SettingsNav } from "./settings-nav";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireRole("sadmin", "admin");
  return (
    <div>
      <h1 className="mb-3 text-2xl font-semibold">Cài đặt</h1>
      <SettingsNav isSadmin={ctx.profile.role === "sadmin"} />
      <div className="mt-4">{children}</div>
    </div>
  );
}
