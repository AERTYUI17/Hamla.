import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireCharityGroup } from "@/lib/server/charity/guard.server";
import { CAMPAIGN_IMAGES_BUCKET } from "@/lib/storage-paths";

const listInput = z.object({});

export const listMyCampaigns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => listInput.parse(data ?? {}))
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    const charityGroupId = await requireCharityGroup(userId);
    const { data: rows, error } = await supabaseAdmin
      .from("campaigns")
      .select("id, title, slug, status, goal_amount, raised_amount, donor_count, cover_image, certified, created_at")
      .eq("charity_group_id", charityGroupId)
      .order("created_at", { ascending: false });
    if (error) throw new Error("تعذر تحميل الحملات.");
    return rows ?? [];
  });

const idInput = z.object({ id: z.string().uuid() });

export const getMyCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const charityGroupId = await requireCharityGroup(userId);
    const { data: c, error } = await supabaseAdmin
      .from("campaigns")
      .select("id, title, slug, description, story, status, certified, goal_amount, raised_amount, donor_count, cover_image, category, location, beneficiary, created_at, updated_at")
      .eq("id", data.id)
      .eq("charity_group_id", charityGroupId)
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

const createInput = z.object({
  title: z.string().min(5).max(120),
  slug: z.string().min(3).max(120).regex(/^[a-z0-9-]+$/),
  description: z.string().min(50).max(280),
  story: z.string().min(200).max(8000),
  beneficiary: z.string().min(2).max(120),
  category: z.enum(["education", "health", "family", "emergency", "orphan", "mosque", "other"]),
  wilaya: z.string().min(1),
  location: z.string().min(2).max(120),
  goalAmount: z.number().int().min(10000).max(50_000_000),
  coverImagePath: z.string().nullable().optional(),
});

export const createMyCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const charityGroupId = await requireCharityGroup(userId);

    const { data: cg } = await supabaseAdmin
      .from("charity_groups")
      .select("name")
      .eq("id", charityGroupId)
      .maybeSingle();

    const { data: existing } = await supabaseAdmin
      .from("campaigns")
      .select("id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (existing) throw new Error("هذا الـ slug مستخدم بالفعل. اختر slug آخر.");

    const { data: row, error } = await supabaseAdmin
      .from("campaigns")
      .insert({
        title: data.title,
        slug: data.slug,
        description: data.description,
        story: data.story,
        beneficiary: data.beneficiary,
        category: data.category,
        location: data.location,
        goal_amount: data.goalAmount,
        cover_image: data.coverImagePath ?? null,
        charity_group_id: charityGroupId,
        status: "submitted",
        currency: "DZD",
        organizer_name: cg?.name ?? "حملة",
      })
      .select("id, slug")
      .single();
    if (error || !row) throw new Error("تعذر إنشاء الحملة.");
    return { id: row.id, slug: row.slug };
  });

const updateInput = z.object({
  id: z.string().uuid(),
  title: z.string().min(5).max(120).optional(),
  description: z.string().min(50).max(280).optional(),
  story: z.string().min(200).max(8000).optional(),
});

export const updateMyCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const charityGroupId = await requireCharityGroup(userId);
    const { id, ...patch } = data;
    const { error } = await supabaseAdmin
      .from("campaigns")
      .update(patch)
      .eq("id", id)
      .eq("charity_group_id", charityGroupId);
    if (error) throw new Error("تعذر تحديث الحملة.");
    return { ok: true };
  });

const statusInput = z.object({ id: z.string().uuid(), to: z.enum(["paused", "published"]) });

export const setMyCampaignStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => statusInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const charityGroupId = await requireCharityGroup(userId);
    if (data.to === "published") {
      throw new Error("لا يمكن للجمعية نشر الحملة مباشرة. انتظر موافقة الإدارة.");
    }
    const { error } = await supabaseAdmin
      .from("campaigns")
      .update({ status: data.to })
      .eq("id", data.id)
      .eq("charity_group_id", charityGroupId);
    if (error) throw new Error("تعذر تغيير حالة الحملة.");
    return { ok: true };
  });

const coverInput = z.object({
  campaignId: z.string().uuid(),
  storagePath: z.string().min(8).max(500),
  mimeType: z.string().min(3).max(100),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024),
});

export const attachCoverImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => coverInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const charityGroupId = await requireCharityGroup(userId);
    const probe = `campaigns/${charityGroupId}/_probe/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const { error: probeError } = await supabaseAdmin.storage
      .from(CAMPAIGN_IMAGES_BUCKET)
      .copy(data.storagePath, probe);
    if (probeError) throw new Error("تعذر التحقق من الصورة المرفوعة.");
    await supabaseAdmin.storage.from(CAMPAIGN_IMAGES_BUCKET).remove([probe]);
    const ext = data.storagePath.slice(data.storagePath.lastIndexOf("."));
    const finalPath = `campaigns/${charityGroupId}/${data.campaignId}/cover${ext}`;
    const { error: moveError } = await supabaseAdmin.storage
      .from(CAMPAIGN_IMAGES_BUCKET)
      .move(data.storagePath, finalPath);
    if (moveError) throw new Error("تعذر نقل الصورة.");
    const { error } = await supabaseAdmin
      .from("campaigns")
      .update({ cover_image: finalPath })
      .eq("id", data.campaignId)
      .eq("charity_group_id", charityGroupId);
    if (error) throw new Error("تعذر حفظ الصورة.");
    return { ok: true, coverImage: finalPath };
  });
