/**
 * SlickPay payment provider stub.
 *
 * SlickPay's published developer documentation is empty at the time of this
 * build (https://developers.slick-pay.com/authentication returns a stub page
 * with no endpoint list, no payload shapes, no webhook signature scheme).
 *
 * Per the spec, we do NOT invent endpoints. This stub satisfies the existing
 * `PaymentProvider` interface and throws a clear "not yet configured" error
 * on every method. The provider registry routes `PAYMENT_PROVIDER=slickpay`
 * to this stub. When real SlickPay documentation arrives, replace the body
 * of these methods; no other file in the application needs to change.
 *
 * Required environment variables (referenced, not validated here):
 *   SLICKPAY_PUBLIC_KEY
 *   SLICKPAY_SECRET_KEY
 *   SLICKPAY_CALLBACK_URL
 *
 * Even when all three are set, the stub still throws — SlickPay is
 * intentionally non-functional until docs are provided.
 */
import {
  type CreatePaymentInput,
  type CreatePaymentResult,
  type PaymentProvider,
  type PaymentSnapshot,
  type WebhookVerificationResult,
  PaymentGatewayError,
} from "./payment-provider";

export const slickpayPaymentProvider: PaymentProvider = {
  id: "slickpay",
  label: "SlickPay",

  async createPayment(_input: CreatePaymentInput): Promise<CreatePaymentResult> {
    throw new PaymentGatewayError(
      "بوابة SlickPay غير مهيأة بعد. أرسل الوثائق الرسمية لفريق حملة.",
    );
  },

  async getPaymentStatus(_reference: string): Promise<PaymentSnapshot> {
    throw new PaymentGatewayError(
      "بوابة SlickPay غير مهيأة بعد. أرسل الوثائق الرسمية لفريق حملة.",
    );
  },

  async verifyPayment(_reference: string): Promise<PaymentSnapshot> {
    throw new PaymentGatewayError(
      "بوابة SlickPay غير مهيأة بعد. أرسل الوثائق الرسمية لفريق حملة.",
    );
  },

  async handleWebhook(): Promise<WebhookVerificationResult> {
    throw new PaymentGatewayError(
      "بوابة SlickPay غير مهيأة بعد. أرسل الوثائق الرسمية لفريق حملة.",
    );
  },
};
