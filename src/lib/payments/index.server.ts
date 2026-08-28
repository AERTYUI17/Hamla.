/** Provider registry. SERVER ONLY. */
import { algerianPaymentProvider } from "./algerian-payment-provider.server";
import { sandboxPaymentProvider } from "./sandbox-payment-provider.server";
import type { PaymentProvider } from "./payment-provider";

export function getPaymentProvider(id?: string | null): PaymentProvider {
  const selected = (id ?? process.env["PAYMENT_PROVIDER"] ?? "algerian-gateway").toLowerCase();
  if (selected === "sandbox") return sandboxPaymentProvider;
  return algerianPaymentProvider;
}

export function isPaymentGatewayConfigured(): boolean {
  if ((process.env["PAYMENT_PROVIDER"] ?? "").toLowerCase() === "sandbox") return true;
  return Boolean(
    process.env["PAYMENT_GATEWAY_URL"] &&
      process.env["PAYMENT_MERCHANT_ID"] &&
      process.env["PAYMENT_API_KEY"] &&
      process.env["PAYMENT_SECRET"] &&
      process.env["PAYMENT_CALLBACK_URL"],
  );
}

export type { PaymentProvider };
