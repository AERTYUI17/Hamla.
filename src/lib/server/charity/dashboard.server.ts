import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireCharityGroup } from "@/lib/server/charity/guard.server";
import { resolveAuthedContext } from "@/lib/server/authed-context.server";

const input = z.object({});

export const getCharityDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => input.parse(data ?? {}))
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    const charityGroupId = await requireCharityGroup(userId);
    const db = supabaseAdmin;

    const { data: balances } = await db.rpc("get_charity_balances", {
      _charity_group_id: charityGroupId,
    });

    const { data: recentCampaigns } = await db
      .from("campaigns")
      .select("id, title, slug, status, goal_amount, raised_amount, donor_count, cover_image, created_at")
      .eq("charity_group_id", charityGroupId)
      .order("created_at", { ascending: false })
      .limit(5);

    const { data: recentLedger } = await db
      .from("ledger_entries")
      .select("id, type, amount, currency, reference, created_at, campaigns(title)")
      .eq("charity_group_id", charityGroupId)
      .order("created_at", { ascending: false })
      .limit(5);

    const { data: cg } = await db
      .from("charity_groups")
      .select("id, name, slug, description, logo_url, category, wilaya, verified, verified_at")
      .eq("id", charityGroupId)
      .maybeSingle();

    return {
      charity: cg,
      balances: (balances as any) ?? {
        totalRaisedDzd: 0,
        totalPaidDzd: 0,
        availableBalanceDzd: 0,
        pendingBalanceDzd: 0,
        campaignCount: 0,
        donorCount: 0,
        donationCount: 0,
      },
      recentCampaigns: recentCampaigns ?? [],
      recentLedger: recentLedger ?? [],
    };
  });

export const getMyCharityGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => input.parse(data ?? {}))
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    const ctx = await resolveAuthedContext(userId);
    if (!ctx.charityGroupId) return null;
    const { data: cg } = await supabaseAdmin
      .from("charity_groups")
      .select("id, name, slug, description, logo_url, category, wilaya, verified, verified_at, status")
      .eq("id", ctx.charityGroupId)
      .maybeSingle();
    return cg;
  });
