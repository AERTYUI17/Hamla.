import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const startInput = z.object({
  slug: z.string().min(1).max(120),
  amount: z.number().finite().positive().max(1_000_000),
  anonymous: z.boolean().default(false),
  message: z.string().max(300).optional(),
  displayName: z.string().min(1).max(80).optional(),
  origin: z.string().url().max(300),
});

const referenceInput = z.object({ reference: z.string().min(6).max(60) });

/**
 * Creates the donation record, its payment attempt, and hands back the
 * official gateway URL. The donation starts as PENDING — only server-side
 * verification can move it to PAID.
 */
export const startDonation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => startInput.parse(data))
  .handler(async ({ data, context }) => {
    const {
      admin,
      assertNotFlooding,
      buildReference,
      getPaymentProvider,
      toUserMessage,
      MIN_DONATION,
      MAX_DONATION,
    } = await import("./server/donations.server");

    if (data.amount < MIN_DONATION || data.amount > MAX_DONATION) {
      throw new Error(`مبلغ التبرع يجب أن يكون بين ${MIN_DONATION} و ${MAX_DONATION} دج.`);
    }
    const amount = Math.round(data.amount);

    await assertNotFlooding(context.userId);
    const db = await admin();

    const { data: campaign } = await db
      .from("campaigns")
      .select("id, title, currency, status, charity_group_id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!campaign || campaign.status !== "published") throw new Error("الحملة غير متوفرة.");

    const { data: profile } = await db
      .from("profiles")
      .select("name, email")
      .eq("id", context.userId)
      .maybeSingle();

    const provider = getPaymentProvider();
    const reference = buildReference();

    const { data: donation, error: donationError } = await db
      .from("donations")
      .insert({
        campaign_id: campaign.id,
        user_id: context.userId,
        amount,
        currency: campaign.currency,
        donor_name: data.displayName ?? profile?.name ?? null,
        donor_email: profile?.email ?? null,
        anonymous: data.anonymous,
        message: data.message?.trim() ? data.message.trim() : null,
        status: "PENDING",
        reference,
        payment_provider: provider.id,
        charity_group_id: campaign.charity_group_id ?? null,
      })
      .select("id")
      .single();
    if (donationError || !donation) throw new Error("تعذر إنشاء التبرع. حاول مرة أخرى.");

    await db.from("payments").insert({
      donation_id: donation.id,
      provider: provider.id,
      status: "PENDING",
      amount,
      currency: campaign.currency,
      raw: {},
    });

    try {
      const created = await provider.createPayment({
        reference,
        amount,
        currency: campaign.currency,
        description: `تبرع لحملة: ${campaign.title}`,
        customerName: data.anonymous ? null : (data.displayName ?? profile?.name ?? null),
        customerEmail: profile?.email ?? null,
        returnUrl: `${data.origin.replace(/\/+$/, "")}/donation/${reference}`,
      });

      await db
        .from("payments")
        .update({
          provider_transaction_id: created.providerTransactionId,
          status: "PROCESSING",
        })
        .eq("donation_id", donation.id);
      await db.from("donations").update({ status: "PROCESSING" }).eq("id", donation.id);

      return { reference, redirectUrl: created.redirectUrl, providerLabel: provider.label };
    } catch (error) {
      await db.from("donations").update({ status: "FAILED" }).eq("id", donation.id);
      await db.from("payments").update({ status: "FAILED" }).eq("donation_id", donation.id);
      throw new Error(toUserMessage(error));
    }
  });

/** Authoritative status read: asks the gateway, then settles the donation. */
export const verifyDonation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => referenceInput.parse(data))
  .handler(async ({ data, context }) => {
    const { admin, getPaymentProvider, toUserMessage } = await import("./server/donations.server");
    const db = await admin();

    const { data: donation } = await db
      .from("donations")
      .select("id, user_id, status, payment_provider, campaigns(title)")
      .eq("reference", data.reference)
      .maybeSingle();
    if (!donation || donation.user_id !== context.userId) throw new Error("لم يتم العثور على التبرع.");

    if (donation.status === "PAID") {
      const { data: invoice } = await db
        .from("invoices")
        .select("invoice_number")
        .eq("donation_id", donation.id)
        .maybeSingle();
      return { status: "PAID" as const, invoiceNumber: invoice?.invoice_number ?? null };
    }

    const { data: payment } = await db
      .from("payments")
      .select("provider_transaction_id")
      .eq("donation_id", donation.id)
      .maybeSingle();

    try {
      const provider = getPaymentProvider(donation.payment_provider);
      const snapshot = await provider.verifyPayment(
        data.reference,
        payment?.provider_transaction_id ?? null,
      );
      const { data: result } = await db.rpc("finalize_donation", {
        _reference: data.reference,
        _status: snapshot.status,
        ...(snapshot.providerTransactionId
          ? { _provider_txn: snapshot.providerTransactionId }
          : {}),
      });

      const settled = (result ?? {}) as { status?: string; invoice_number?: string | null };
      return {
        status: (settled.status ?? snapshot.status) as string,
        invoiceNumber: settled.invoice_number ?? null,
      };
    } catch (error) {
      throw new Error(toUserMessage(error));
    }
  });

/** Receipt data for the donor who made the donation. */
export const getReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => referenceInput.parse(data))
  .handler(async ({ data, context }) => {
    const { admin } = await import("./server/donations.server");
    const db = await admin();

    const { data: donation } = await db
      .from("donations")
      .select(
        "id, user_id, amount, currency, donor_name, donor_email, anonymous, message, status, reference, payment_provider, paid_at, created_at, campaigns(title, slug)",
      )
      .eq("reference", data.reference)
      .maybeSingle();
    if (!donation || donation.user_id !== context.userId) throw new Error("لم يتم العثور على الإيصال.");

    const { data: invoice } = await db
      .from("invoices")
      .select("invoice_number, issued_at, emailed_at")
      .eq("donation_id", donation.id)
      .maybeSingle();

    const { getPaymentProvider } = await import("./server/donations.server");
    const providerLabel = getPaymentProvider(donation.payment_provider).label;
    const campaign = donation.campaigns as unknown as { title: string; slug: string } | null;

    return {
      reference: donation.reference,
      amount: Number(donation.amount),
      currency: donation.currency,
      donorName: donation.anonymous ? "متبرع مجهول" : (donation.donor_name ?? "متبرع"),
      donorEmail: donation.donor_email,
      anonymous: donation.anonymous,
      message: donation.message,
      status: donation.status,
      providerLabel,
      paidAt: donation.paid_at ?? donation.created_at,
      campaignTitle: campaign?.title ?? "",
      campaignSlug: campaign?.slug ?? "",
      invoiceNumber: invoice?.invoice_number ?? null,
      issuedAt: invoice?.issued_at ?? null,
      emailedAt: invoice?.emailed_at ?? null,
    };
  });

export const emailReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => referenceInput.parse(data))
  .handler(async ({ data, context }) => {
    const { admin } = await import("./server/donations.server");
    const { getEmailProvider, receiptEmailHtml } = await import("./server/email.server");
    const { formatDZD, formatDate } = await import("./format");
    const db = await admin();

    const { data: donation } = await db
      .from("donations")
      .select("id, user_id, amount, donor_name, donor_email, anonymous, reference, status, paid_at, campaigns(title)")
      .eq("reference", data.reference)
      .maybeSingle();
    if (!donation || donation.user_id !== context.userId) throw new Error("لم يتم العثور على الإيصال.");
    if (donation.status !== "PAID") throw new Error("لا يمكن إرسال الإيصال قبل تأكيد الدفع.");
    if (!donation.donor_email) throw new Error("لا يوجد بريد إلكتروني مرتبط بهذا التبرع.");

    const { data: invoice } = await db
      .from("invoices")
      .select("invoice_number")
      .eq("donation_id", donation.id)
      .maybeSingle();

    const campaign = donation.campaigns as unknown as { title: string } | null;
    const appUrl = process.env["APP_URL"] || "";
    const result = await getEmailProvider().send({
      to: donation.donor_email,
      subject: `إيصال التبرع — ${invoice?.invoice_number ?? donation.reference}`,
      html: receiptEmailHtml({
        donorName: donation.anonymous ? "متبرع مجهول" : (donation.donor_name ?? "متبرع"),
        campaignTitle: campaign?.title ?? "",
        amountLabel: formatDZD(Number(donation.amount)),
        invoiceNumber: invoice?.invoice_number ?? "—",
        reference: donation.reference,
        dateLabel: formatDate(donation.paid_at ?? new Date().toISOString()),
        receiptUrl: `${appUrl}/receipt/${donation.reference}`,
      }),
    });

    if (!result.sent) {
      if (result.reason === "not_configured") {
        throw new Error("خدمة البريد الإلكتروني غير مهيأة بعد. يمكنك تحميل الإيصال أو طباعته.");
      }
      throw new Error("تعذر إرسال الإيصال إلى البريد الإلكتروني. حاول مرة أخرى.");
    }

    await db.from("invoices").update({ emailed_at: new Date().toISOString() }).eq("donation_id", donation.id);
    return { sent: true, to: donation.donor_email };
  });

/** Test mode only: records the outcome chosen on the sandbox checkout page. */
export const recordSandboxOutcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        reference: z.string().min(6).max(60),
        outcome: z.enum(["PAID", "FAILED", "CANCELLED"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    if ((process.env["PAYMENT_PROVIDER"] ?? "").toLowerCase() !== "sandbox") {
      throw new Error("غير متاح.");
    }
    const { admin } = await import("./server/donations.server");
    const db = await admin();
    const { data: donation } = await db
      .from("donations")
      .select("id, user_id")
      .eq("reference", data.reference)
      .maybeSingle();
    if (!donation || donation.user_id !== context.userId) throw new Error("لم يتم العثور على التبرع.");

    await db
      .from("payments")
      .update({ raw: { sandbox: true, sandbox_status: data.outcome } })
      .eq("donation_id", donation.id);
    return { ok: true };
  });
