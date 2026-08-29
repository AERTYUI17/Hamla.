import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "@/lib/server/admin/guard.server";

const listInput = z.object({ status: z.string().nullable().optional() });

export const listAdminPayouts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => listInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    let q = supabaseAdmin
      .from("payouts")
      .select("id, amount, currency, status, requested_at, charity_groups(name)")
      .order("requested_at", { ascending: false });
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error("تعذر تحميل السحوبات.");
    return rows ?? [];
  });

const idInput = z.object({ id: z.string().uuid() });

export const getAdminPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    const { data: p, error } = await supabaseAdmin
      .from("payouts")
      .select("*, charity_groups(name, slug, user_id)")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !p) throw new Error("السحب غير موجود.");
    return p;
  });

const approveInput = z.object({ id: z.string().uuid() });

export const approvePayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => approveInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    const { error } = await supabaseAdmin.rpc("approve_payout", {
      _payout_id: data.id, _admin_id: userId,
    });
    if (error) throw new Error(error.message || "تعذر الموافقة على السحب.");
    return { ok: true };
  });

const rejectInput = z.object({ id: z.string().uuid(), reason: z.string().min(10).max(500) });

export const rejectPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => rejectInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    const { error } = await supabaseAdmin.rpc("reject_payout", {
      _payout_id: data.id, _admin_id: userId, _reason: data.reason,
    });
    if (error) throw new Error(error.message || "تعذر رفض السحب.");
    return { ok: true };
  });

const markPaidInput = z.object({
  id: z.string().uuid(),
  external_reference: z.string().min(3).max(80),
});

export const markPayoutPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => markPaidInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    const { error } = await supabaseAdmin.rpc("mark_payout_paid", {
      _payout_id: data.id, _admin_id: userId, _external_reference: data.external_reference,
    });
    if (error) throw new Error(error.message || "تعذر تأكيد الدفع.");
    return { ok: true };
  });
