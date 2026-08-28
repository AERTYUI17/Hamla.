/**
 * Gateway webhook endpoint. External callers only.
 *
 * The signature is verified by the active payment provider before anything is
 * read from the body, and settlement happens through the database routine so
 * it stays atomic and idempotent.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/payment-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();

        const { getPaymentProvider } = await import("@/lib/payments/index.server");
        const provider = getPaymentProvider(process.env["PAYMENT_PROVIDER"]);

        let result;
        try {
          result = await provider.handleWebhook(rawBody, request.headers);
        } catch {
          return new Response("invalid signature", { status: 401 });
        }

        if (!result.verified || !result.reference) {
          return new Response("invalid signature", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.rpc("finalize_donation", {
          _reference: result.reference,
          _status: result.status,
          ...(result.providerTransactionId
            ? { _provider_txn: result.providerTransactionId }
            : {}),
        });

        if (error) {
          console.error("webhook settlement failed", error.message);
          return new Response("settlement failed", { status: 500 });
        }

        return Response.json({ received: true });
      },
    },
  },
});
