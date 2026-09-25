import { AppHeader } from "@/components/app-header";
import { homeStoreCode, requireSession } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireSession();

  return (
    <div className="min-h-dvh bg-muted/30">
      <AppHeader
        fullName={ctx.profile.full_name}
        role={ctx.profile.role}
        stores={ctx.stores}
        defaultStoreCode={homeStoreCode(ctx)}
      />
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
