import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Server-side admin guard. Call as the FIRST line of every admin server-fn.
 * Throws if the caller is not an admin. Returns the admin user id on success.
 *
 * Non-admin callers see a generic "not found" error so the existence of
 * admin endpoints is not disclosed.
 */
export async function requireAdmin(userId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) {
    const e: Error & { status?: number } = new Error("Not found");
    e.status = 404;
    throw e;
  }
  return userId;
}
