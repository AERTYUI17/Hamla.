import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveAuthedContext } from "@/lib/server/authed-context.server";

/**
 * Ensures the caller is a charity_group and returns their charity_groups.id.
 * Throws if not.
 */
export async function requireCharityGroup(userId: string): Promise<string> {
  const ctx = await resolveAuthedContext(userId);
  if (ctx.role !== "charity_group" || !ctx.charityGroupId) {
    const e: Error & { status?: number } = new Error("Not found");
    e.status = 404;
    throw e;
  }
  const { data: cg } = await supabaseAdmin
    .from("charity_groups")
    .select("status, verified")
    .eq("id", ctx.charityGroupId)
    .maybeSingle();
  if (!cg || !cg.verified || cg.status !== "approved") {
    const e: Error & { status?: number } = new Error("Not found");
    e.status = 404;
    throw e;
  }
  return ctx.charityGroupId;
}
