import { AppShell } from "@/components/app-shell";
import { homeStoreCode, requireSession } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireSession();

  return (
    <AppShell
      fullName={ctx.profile.full_name}
      role={ctx.profile.role}
      stores={ctx.stores}
      defaultStoreCode={homeStoreCode(ctx)}
    >
      {children}
    </AppShell>
  );
}
