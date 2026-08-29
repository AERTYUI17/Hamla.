import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "@/lib/server/admin/guard.server";

const listInput = z.object({ status: z.string().nullable().optional() });

export const listAdminDonations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => listInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    let q = supabaseAdmin
      .from("donations")
      .select("id, reference, amount, currency, donor_name, donor_email, anonymous, status, created_at, paid_at, campaigns(title, slug)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error("تعذر تحميل التبرعات.");
    return rows ?? [];
  });

const idInput = z.object({ id: z.string().uuid() });

export const getAdminDonation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    const db = supabaseAdmin;
    const { data: d, error } = await db
      .from("donations")
      .select("*, campaigns(title, slug), invoices(invoice_number, issued_at)")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !d) throw new Error("التبرع غير موجود.");
    const { data: payment } = await db
      .from("payments")
      .select("provider, provider_transaction_id, status, raw")
      .eq("donation_id", data.id)
      .maybeSingle();
    const { data: ledger } = await db
      .from("ledger_entries")
      .select("id, type, amount, currency, status, reference, created_at")
      .eq("donation_id", data.id)
      .maybeSingle();
    return { donation: d, payment, ledger };
  });

const numberInput = z.object({ invoiceNumber: z.string().min(1).max(50) });

/**
 * Returns the full invoice (donation, payment, ledger) for the given
 * invoice_number. Admin-only. Used by the admin donation detail page
 * and any future "view invoice" call.
 */
export const getInvoiceByNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => numberInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    const db = supabaseAdmin;

    const { data: inv, error } = await db
      .from("invoices")
      .select("id, donation_id, invoice_number, amount, currency, reference, issued_at, emailed_at")
      .eq("invoice_number", data.invoiceNumber)
      .maybeSingle();
    if (error || !inv) throw new Error("الفاتورة غير موجودة.");

    const { data: donation } = await db
      .from("donations")
      .select("id, amount, currency, donor_name, donor_email, anonymous, status, reference, paid_at, created_at, campaigns(title, slug)")
      .eq("id", inv.donation_id)
      .maybeSingle();
    if (!donation) throw new Error("التبرع المرتبط غير موجود.");

    const { data: payment } = await db
      .from("payments")
      .select("provider, provider_transaction_id, status, raw")
      .eq("donation_id", donation.id)
      .maybeSingle();
    const { data: ledger } = await db
      .from("ledger_entries")
      .select("id, type, amount, currency, status, reference, created_at")
      .eq("donation_id", donation.id)
      .maybeSingle();
    return { invoice: inv, donation, payment, ledger };
  });
