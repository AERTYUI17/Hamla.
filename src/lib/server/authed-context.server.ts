import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface AuthedContext {
  userId: string;
  displayName: string;
  role: "user" | "charity_group" | "admin";
  charityGroupId: string | null;
}

/**
 * Resolves the full authed context for the current request: userId, role,
 * and (if the user is a charity_group) the charity_groups.id they own.
 *
 * Used by every route under /charity/* and /dashboard/* in their loader.
 */
export async function resolveAuthedContext(userId: string): Promise<AuthedContext> {
  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  const role = (roleRow?.role ?? "user") as AuthedContext["role"];

  let displayName = "مستخدم";
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("name, email")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.name) displayName = profile.name;
  else if (profile?.email) displayName = profile.email;

  let charityGroupId: string | null = null;
  if (role === "charity_group") {
    const { data: cg } = await supabaseAdmin
      .from("charity_groups")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    charityGroupId = cg?.id ?? null;
  }

  return { userId, displayName, role, charityGroupId };
}
