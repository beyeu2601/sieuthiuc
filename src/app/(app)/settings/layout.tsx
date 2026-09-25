import { requireRole } from "@/lib/auth";
import { SettingsNav } from "./settings-nav";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireRole("sadmin", "admin");
  return (
    <div>
      <h1 className="mb-3 text-2xl font-semibold">Cài đặt</h1>
      <SettingsNav />
      <div className="mt-4">{children}</div>
    </div>
  );
}
