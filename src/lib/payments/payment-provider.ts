/**
 * Payment provider abstraction.
 *
 * Nothing in the application depends on a concrete gateway: the donation
 * pipeline only talks to this interface, so the Algerian gateway can be
 * swapped or re-pointed without touching the donation system.
 *
 * This file is intentionally free of secrets and of any runtime dependency,
 * so it can be imported from both client and server code (types only on the
 * client side).
 */

export type PaymentStatus =
  | "PENDING"
  | "PROCESSING"
  | "PAID"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED";

export interface CreatePaymentInput {
  /** Our own unique, idempotent reference (also the idempotency key). */
  reference: string;
  amount: number;
  currency: string;
  description: string;
  customerName?: string | null;
  customerEmail?: string | null;
  /** Where the gateway sends the payer back after the attempt. */
  returnUrl: string;
}

export interface CreatePaymentResult {
  /** Gateway-side identifier of the payment attempt, when returned. */
  providerTransactionId: string | null;
  /** URL of the official gateway checkout page to send the payer to. */
  redirectUrl: string;
  status: PaymentStatus;
  raw?: unknown;
}

export interface PaymentSnapshot {
  providerTransactionId: string | null;
  status: PaymentStatus;
  amount: number | null;
  currency: string | null;
  raw?: unknown;
}

export interface WebhookVerificationResult {
  reference: string | null;
  providerTransactionId: string | null;
  status: PaymentStatus;
  raw?: unknown;
}

export interface PaymentProvider {
  readonly id: string;
  /** Human label shown to donors (e.g. on the receipt). */
  readonly label: string;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  /** Authoritative, server-side status read straight from the gateway. */
  getPaymentStatus(reference: string, providerTransactionId?: string | null): Promise<PaymentSnapshot>;
  /** Convenience wrapper used before marking a donation as PAID. */
  verifyPayment(reference: string, providerTransactionId?: string | null): Promise<PaymentSnapshot>;
  /** Verifies the signature of an inbound webhook and normalises it. */
  handleWebhook(rawBody: string, headers: Headers): Promise<WebhookVerificationResult>;
}

export class PaymentConfigurationError extends Error {
  code = "payment_not_configured" as const;
}

export class PaymentGatewayError extends Error {
  code = "payment_gateway_error" as const;
}
