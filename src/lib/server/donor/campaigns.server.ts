import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { publicClient } from "@/lib/server/public-db.server";

const listInput = z.object({
  category: z.string().nullable().optional(),
  certifiedOnly: z.boolean().nullable().optional(),
  verifiedCharityOnly: z.boolean().nullable().optional(),
  sort: z.enum(["recent", "most_funded", "ending_soon"]).default("recent"),
  limit: z.number().int().min(1).max(60).default(24),
  offset: z.number().int().nonnegative().default(0),
});

export const listPublicCampaigns = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => listInput.parse(data))
  .handler(async ({ data }) => {
    const db = publicClient();
    let q = db
      .from("campaigns")
      .select("id, slug, title, cover_image, goal_amount, raised_amount, donor_count, certified, category, location, created_at, charity_groups(name, verified, status)")
      .eq("status", "published");
    if (data.category) q = q.eq("category", data.category);
    if (data.certifiedOnly) q = q.eq("certified", true);
    if (data.verifiedCharityOnly) q = q.eq("charity_groups.verified", true);
    if (data.sort === "most_funded") {
      q = q.order("raised_amount", { ascending: false });
    } else {
      q = q.order("created_at", { ascending: false });
    }
    q = q.range(data.offset, data.offset + data.limit - 1);
    const { data: rows, error } = await q;
    if (error) throw new Error("تعذر تحميل الحملات.");
    return (rows ?? []).map((r: any) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      cover_image: r.cover_image,
      goal_amount: r.goal_amount,
      raised_amount: r.raised_amount,
      donor_count: r.donor_count,
      certified: r.certified,
      charityName: r.charity_groups?.name ?? null,
      charityVerified: r.charity_groups?.verified === true && r.charity_groups?.status === "approved",
    }));
  });
