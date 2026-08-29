import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "@/lib/server/admin/guard.server";

const listInput = z.object({ offset: z.number().int().nonnegative() });

export const listAdminAuditLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => listInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    const { data: rows, error } = await supabaseAdmin
      .from("audit_logs")
      .select("id, action, target_type, target_id, metadata, created_at, admin_id")
      .order("created_at", { ascending: false })
      .range(data.offset, data.offset + 49);
    if (error) throw new Error("تعذر تحميل سجل النشاط.");
    return rows ?? [];
  });
