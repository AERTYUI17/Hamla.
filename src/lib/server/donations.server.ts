import { getPaymentProvider } from "@/lib/payments/index.server";
import { PaymentConfigurationError, PaymentGatewayError } from "@/lib/payments/payment-provider";

export const MIN_DONATION = 100;
export const MAX_DONATION = 1_000_000;

export function buildReference(): string {
  const year = new Date().getFullYear();
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  const rand = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()
    .slice(0, 8);
  return `HAMLA-TXN-${year}-${rand}`;
}

export async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Simple abuse guard: max 5 payment attempts per user per minute. */
export async function assertNotFlooding(userId: string) {
  const db = await admin();
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await db
    .from("donations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);
  if ((count ?? 0) >= 5) {
    throw new Error("عدد كبير من المحاولات. يرجى الانتظار قليلاً قبل إعادة المحاولة.");
  }
}

export function toUserMessage(error: unknown): string {
  if (error instanceof PaymentConfigurationError) return error.message;
  if (error instanceof PaymentGatewayError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "حدث خطأ غير متوقع. حاول مرة أخرى.";
}

export { getPaymentProvider };
