import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const slugInput = z.object({ slug: z.string().min(1).max(120) });

const donationsInput = z.object({
  slug: z.string().min(1).max(120),
  order: z.enum(["recent", "top"]).default("recent"),
  limit: z.number().int().min(1).max(100).default(10),
});

export const getCampaign = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => slugInput.parse(data))
  .handler(async ({ data }) => {
    const { publicClient } = await import("./server/public-db.server");
    const { data: campaign, error } = await publicClient()
      .from("campaigns")
      .select(
        "id, title, slug, description, story, cover_image, goal_amount, raised_amount, donor_count, currency, category, organizer_name, organizer_avatar, organizer_relation, beneficiary, location, verified, created_at",
      )
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();

    if (error) throw new Error("تعذر تحميل الحملة.");
    return campaign;
  });

export const getCampaignDonations = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => donationsInput.parse(data))
  .handler(async ({ data }) => {
    const { publicClient } = await import("./server/public-db.server");
    const { data: rows, error } = await publicClient().rpc("campaign_donations", {
      _slug: data.slug,
      _limit: data.limit,
      _order: data.order,
    });
    if (error) throw new Error("تعذر تحميل قائمة التبرعات.");
    return rows ?? [];
  });
