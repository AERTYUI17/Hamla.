import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { publicClient } from "@/lib/server/public-db.server";

const input = z.object({ slug: z.string().min(1).max(120) });

export const getPublicCharityBySlug = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data }) => {
    const db = publicClient();
    const { data: cg, error } = await db
      .from("charity_groups")
      .select("id, name, slug, description, category, wilaya, logo_url, verified, verified_at")
      .eq("slug", data.slug)
      .eq("status", "approved")
      .eq("verified", true)
      .maybeSingle();
    if (error || !cg) throw new Error("الجمعية غير موجودة.");
    const { data: campaigns } = await db
      .from("campaigns")
      .select("id, title, slug, status, certified, goal_amount, raised_amount, donor_count, cover_image, created_at")
      .eq("charity_group_id", cg.id)
      .eq("status", "published")
      .order("created_at", { ascending: false });
    return { charity: cg, campaigns: campaigns ?? [] };
  });
