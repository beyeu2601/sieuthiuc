import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";

// Chan truy cap cua hang khong duoc gan (RLS cung chan o tang du lieu).
export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ store: string }>;
}) {
  const { store } = await params;
  const ctx = await requireSession();
  if (!ctx.stores.some((s) => s.code === store)) notFound();
  return children;
}
