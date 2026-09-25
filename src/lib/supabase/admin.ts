import "server-only";
import { createClient } from "@supabase/supabase-js";

// Chi dung o server (Server Action / Route Handler) sau khi da kiem tra quyen nguoi goi.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Thiếu SUPABASE_SERVICE_ROLE_KEY");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
