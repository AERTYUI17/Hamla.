import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "@/lib/server/admin/guard.server";

const input = z.object({});

export const getAdminDashboardTotals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => input.parse(data ?? {}))
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    const db = supabaseAdmin;

    const [
      { count: totalUsers },
      { count: totalDonors },
      { count: totalCharityGroups },
      { count: totalAdmins },
      { count: pendingApplications },
      { count: approvedCharityGroups },
      { count: totalCampaigns },
      { count: publishedCampaigns },
      { count: certifiedCampaigns },
      { count: submittedCampaigns },
      { count: suspendedCampaigns },
    ] = await Promise.all([
      db.from("user_roles").select("*", { count: "exact", head: true }),
      db.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "user"),
      db.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "charity_group"),
      db.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "admin"),
      db.from("charity_applications").select("*", { count: "exact", head: true }).eq("status", "submitted"),
      db.from("charity_groups").select("*", { count: "exact", head: true }).eq("verified", true),
      db.from("campaigns").select("*", { count: "exact", head: true }),
      db.from("campaigns").select("*", { count: "exact", head: true }).eq("status", "published"),
      db.from("campaigns").select("*", { count: "exact", head: true }).eq("certified", true),
      db.from("campaigns").select("*", { count: "exact", head: true }).eq("status", "submitted"),
      db.from("campaigns").select("*", { count: "exact", head: true }).eq("status", "suspended"),
    ]);

    const { count: totalDonations, data: paidSum } = await db
      .from("donations")
      .select("amount", { count: "exact" })
      .eq("status", "PAID");
    const totalRaisedDzd = (paidSum ?? []).reduce(
      (acc, r) => acc + Number(r.amount ?? 0),
      0,
    );

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: last24hCount, data: last24hSum } = await db
      .from("donations")
      .select("amount", { count: "exact" })
      .eq("status", "PAID")
      .gte("paid_at", since24h);
    const last24hAmountDzd = (last24hSum ?? []).reduce(
      (acc, r) => acc + Number(r.amount ?? 0),
      0,
    );

    const { count: pendingPayouts } = await db
      .from("payouts")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");
    const { count: approvedPayouts } = await db
      .from("payouts")
      .select("*", { count: "exact", head: true })
      .eq("status", "approved");
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);
    const { count: paidThisMonth, data: paidMonth } = await db
      .from("payouts")
      .select("amount", { count: "exact" })
      .eq("status", "paid")
      .gte("paid_at", startOfMonth.toISOString());
    const totalPaidDzd = (paidMonth ?? []).reduce(
      (acc, r) => acc + Number(r.amount ?? 0),
      0,
    );

    const { data: recentActivity } = await db
      .from("audit_logs")
      .select("id, action, target_type, target_id, metadata, created_at, admin_id")
      .order("created_at", { ascending: false })
      .limit(10);

    return {
      users: {
        total: totalUsers ?? 0,
        donors: totalDonors ?? 0,
        charityGroups: totalCharityGroups ?? 0,
        admins: totalAdmins ?? 0,
      },
      charities: {
        pendingApplications: pendingApplications ?? 0,
        approved: approvedCharityGroups ?? 0,
      },
      campaigns: {
        total: totalCampaigns ?? 0,
        published: publishedCampaigns ?? 0,
        certified: certifiedCampaigns ?? 0,
        submitted: submittedCampaigns ?? 0,
        suspended: suspendedCampaigns ?? 0,
      },
      donations: {
        totalCount: totalDonations ?? 0,
        totalRaisedDzd,
        last24hCount: last24hCount ?? 0,
        last24hAmountDzd,
      },
      payouts: {
        pending: pendingPayouts ?? 0,
        approved: approvedPayouts ?? 0,
        paidThisMonth: paidThisMonth ?? 0,
        totalPaidDzd,
      },
      recentActivity: recentActivity ?? [],
    };
  });
