import { redirect } from "next/navigation";
import { homeStoreCode, requireSession } from "@/lib/auth";

export default async function Home() {
  const ctx = await requireSession();
  const code = homeStoreCode(ctx);
  if (!code) redirect("/forbidden?reason=no-store");
  redirect(`/${code}`);
}
