/**
 * Test-mode provider. SERVER ONLY.
 *
 * Only active when PAYMENT_PROVIDER=sandbox is explicitly set. It never
 * pretends to be a real gateway: the checkout page it points to is clearly
 * labelled as test mode, and the status it reports is the one recorded on the
 * server by that page — the browser still cannot declare a donation paid.
 */
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
  PaymentSnapshot,
  PaymentStatus,
  WebhookVerificationResult,
} from "./payment-provider";
import { PaymentGatewayError } from "./payment-provider";

async function readRecordedStatus(reference: string): Promise<PaymentStatus> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("payments")
    .select("raw, donations!inner(reference)")
    .eq("donations.reference", reference)
    .maybeSingle();
  const raw = (data?.raw ?? {}) as Record<string, unknown>;
  const recorded = raw["sandbox_status"];
  if (recorded === "PAID" || recorded === "FAILED" || recorded === "CANCELLED") return recorded;
  return "PENDING";
}

export const sandboxPaymentProvider: PaymentProvider = {
  id: "sandbox",
  label: "وضع الاختبار (بدون دفع حقيقي)",

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    return {
      providerTransactionId: `SBX-${input.reference}`,
      redirectUrl: `/payment-sandbox?reference=${encodeURIComponent(input.reference)}`,
      status: "PENDING",
      raw: { sandbox: true },
    };
  },

  async getPaymentStatus(reference): Promise<PaymentSnapshot> {
    return {
      providerTransactionId: `SBX-${reference}`,
      status: await readRecordedStatus(reference),
      amount: null,
      currency: null,
    };
  },

  async verifyPayment(reference): Promise<PaymentSnapshot> {
    return sandboxPaymentProvider.getPaymentStatus(reference);
  },

  async handleWebhook(): Promise<WebhookVerificationResult> {
    throw new PaymentGatewayError("Webhooks are not available in test mode.");
  },
};
