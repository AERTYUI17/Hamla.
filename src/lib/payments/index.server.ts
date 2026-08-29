/** Provider registry. SERVER ONLY. */
import { algerianPaymentProvider } from "./algerian-payment-provider.server";
import { sandboxPaymentProvider } from "./sandbox-payment-provider.server";
import { slickpayPaymentProvider } from "./slickpay-provider.server";
import type { PaymentProvider } from "./payment-provider";

export function getPaymentProvider(id?: string | null): PaymentProvider {
  const selected = (id ?? process.env["PAYMENT_PROVIDER"] ?? "algerian-gateway").toLowerCase();
  if (selected === "sandbox") return sandboxPaymentProvider;
  if (selected === "slickpay") return slickpayPaymentProvider;
  return algerianPaymentProvider;
}

export function isPaymentGatewayConfigured(): boolean {
  const selected = (process.env["PAYMENT_PROVIDER"] ?? "").toLowerCase();
  if (selected === "sandbox") return true;
  if (selected === "slickpay") {
    // The stub is selected, but the real SlickPay integration is not yet
    // implemented. Return true when the env keys are present so the admin
    // settings page can show a "configured but not implemented" warning
    // instead of an error.
    return Boolean(
      process.env["SLICKPAY_PUBLIC_KEY"] && process.env["SLICKPAY_SECRET_KEY"],
    );
  }
  return Boolean(
    process.env["PAYMENT_GATEWAY_URL"] &&
      process.env["PAYMENT_MERCHANT_ID"] &&
      process.env["PAYMENT_API_KEY"] &&
      process.env["PAYMENT_SECRET"] &&
      process.env["PAYMENT_CALLBACK_URL"],
  );
}

export type { PaymentProvider };
