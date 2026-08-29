import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "@/lib/server/admin/guard.server";

const listInput = z.object({ status: z.string().nullable().optional() });

export const listAdminCampaigns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => listInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    let q = supabaseAdmin
      .from("campaigns")
      .select("id, title, slug, goal_amount, raised_amount, status, certified, created_at, charity_groups(name)")
      .order("created_at", { ascending: false });
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error("تعذر تحميل الحملات.");
    return rows ?? [];
  });

const idInput = z.object({ id: z.string().uuid() });

export const getAdminCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    const { data: c, error } = await supabaseAdmin
      .from("campaigns")
      .select("*, charity_groups(name, slug, verified)")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !c) throw new Error("الحملة غير موجودة.");
    const { data: donations } = await supabaseAdmin
      .from("donations")
      .select("id, reference, amount, donor_name, anonymous, status, created_at, paid_at")
      .eq("campaign_id", data.id)
      .order("created_at", { ascending: false })
      .limit(20);
    return { campaign: c, donations: donations ?? [] };
  });

const actionInput = z.object({ id: z.string().uuid() });

export const publishCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => actionInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    const { error } = await supabaseAdmin.rpc("publish_campaign", {
      _campaign_id: data.id, _admin_id: userId,
    });
    if (error) throw new Error(error.message || "تعذر نشر الحملة.");
    return { ok: true };
  });

const rejectInput = z.object({ id: z.string().uuid(), reason: z.string().min(10).max(500) });

export const rejectCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => rejectInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    const { error } = await supabaseAdmin.rpc("reject_campaign", {
      _campaign_id: data.id, _admin_id: userId, _reason: data.reason,
    });
    if (error) throw new Error(error.message || "تعذر رفض الحملة.");
    return { ok: true };
  });

const suspendInput = z.object({ id: z.string().uuid(), reason: z.string().min(10).max(500) });

export const suspendCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => suspendInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    const { error } = await supabaseAdmin.rpc("suspend_campaign", {
      _campaign_id: data.id, _admin_id: userId, _reason: data.reason,
    });
    if (error) throw new Error(error.message || "تعذر تعليق الحملة.");
    return { ok: true };
  });

export const reactivateCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => actionInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    const { error } = await supabaseAdmin.rpc("reactivate_campaign", {
      _campaign_id: data.id, _admin_id: userId,
    });
    if (error) throw new Error(error.message || "تعذر إعادة التفعيل.");
    return { ok: true };
  });

export const certifyCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => actionInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    const { error } = await supabaseAdmin.rpc("certify_campaign", {
      _campaign_id: data.id, _admin_id: userId,
    });
    if (error) throw new Error(error.message || "تعذر توثيق الحملة.");
    return { ok: true };
  });

const removeCertInput = z.object({ id: z.string().uuid(), reason: z.string().min(10).max(500) });

export const removeCampaignCertification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => removeCertInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    const { error } = await supabaseAdmin.rpc("remove_campaign_certification", {
      _campaign_id: data.id, _admin_id: userId, _reason: data.reason,
    });
    if (error) throw new Error(error.message || "تعذر إلغاء التوثيق.");
    return { ok: true };
  });
