import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireCharityGroup } from "@/lib/server/charity/guard.server";

const listInput = z.object({});

export const listMyPayouts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => listInput.parse(data ?? {}))
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    const charityGroupId = await requireCharityGroup(userId);
    const { data: rows, error } = await supabaseAdmin
      .from("payouts")
      .select("id, amount, currency, status, destination, requested_at, paid_at, rejection_reason, external_reference")
      .eq("charity_group_id", charityGroupId)
      .order("requested_at", { ascending: false });
    if (error) throw new Error("تعذر تحميل السحوبات.");
    return rows ?? [];
  });

const destinationSchema = z.object({
  method: z.enum(["ccp", "bank", "baridimob"]),
  account_name: z.string().min(2).max(120),
  account_number: z.string().min(4).max(40),
  bank_name: z.string().optional(),
  rib: z.string().optional(),
  phone: z.string().optional(),
});

const requestInput = z.object({
  amount: z.number().int().min(1000),
  destination: destinationSchema,
});

export const requestMyPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => requestInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const charityGroupId = await requireCharityGroup(userId);
    const { data: payoutId, error } = await supabaseAdmin.rpc("request_payout", {
      _charity_group_id: charityGroupId,
      _amount: data.amount,
      _currency: "DZD",
      _destination: data.destination,
    });
    if (error) throw new Error(error.message || "تعذر إنشاء طلب السحب.");
    return { payoutId };
  });
