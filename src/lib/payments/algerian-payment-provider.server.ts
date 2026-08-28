/**
 * Adapter for the Algerian payment gateway.
 *
 * SERVER ONLY. Credentials are read from environment variables inside each
 * call and never leave the server. No endpoint is invented: the base URL and
 * the paths are configuration, so the adapter can be pointed at the real
 * provider once its API contract is known.
 *
 * Required environment variables:
 *   PAYMENT_GATEWAY_URL   base URL of the gateway API
 *   PAYMENT_MERCHANT_ID   merchant identifier
 *   PAYMENT_API_KEY       public API key / client id
 *   PAYMENT_SECRET        signing secret (HMAC SHA-256)
 *   PAYMENT_CALLBACK_URL  absolute URL the gateway redirects the payer to
 * Optional:
 *   PAYMENT_CREATE_PATH   default "/payments"
 *   PAYMENT_STATUS_PATH   default "/payments/{id}"  ({id} / {reference})
 */
import { createHmac, timingSafeEqual } from "node:crypto";

import {
  PaymentConfigurationError,
  PaymentGatewayError,
  type CreatePaymentInput,
  type CreatePaymentResult,
  type PaymentProvider,
  type PaymentSnapshot,
  type PaymentStatus,
  type WebhookVerificationResult,
} from "./payment-provider";

interface GatewayConfig {
  baseUrl: string;
  merchantId: string;
  apiKey: string;
  secret: string;
  callbackUrl: string;
  createPath: string;
  statusPath: string;
}

function readConfig(): GatewayConfig {
  const baseUrl = process.env["PAYMENT_GATEWAY_URL"];
  const merchantId = process.env["PAYMENT_MERCHANT_ID"];
  const apiKey = process.env["PAYMENT_API_KEY"];
  const secret = process.env["PAYMENT_SECRET"];
  const callbackUrl = process.env["PAYMENT_CALLBACK_URL"];

  const missing = [
    ["PAYMENT_GATEWAY_URL", baseUrl],
    ["PAYMENT_MERCHANT_ID", merchantId],
    ["PAYMENT_API_KEY", apiKey],
    ["PAYMENT_SECRET", secret],
    ["PAYMENT_CALLBACK_URL", callbackUrl],
  ]
    .filter(([, v]) => !v)
    .map(([k]) => k as string);

  if (missing.length > 0) {
    // Never echo values — only the names of what is missing.
    throw new PaymentConfigurationError(
      `بوابة الدفع غير مهيأة بعد. الإعدادات الناقصة: ${missing.join(", ")}`,
    );
  }

  return {
    baseUrl: baseUrl!.replace(/\/+$/, ""),
    merchantId: merchantId!,
    apiKey: apiKey!,
    secret: secret!,
    callbackUrl: callbackUrl!,
    createPath: process.env["PAYMENT_CREATE_PATH"] || "/payments",
    statusPath: process.env["PAYMENT_STATUS_PATH"] || "/payments/{id}",
  };
}

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

const STATUS_MAP: Record<string, PaymentStatus> = {
  pending: "PENDING",
  created: "PENDING",
  initiated: "PENDING",
  processing: "PROCESSING",
  in_progress: "PROCESSING",
  authorized: "PROCESSING",
  paid: "PAID",
  success: "PAID",
  succeeded: "PAID",
  completed: "PAID",
  captured: "PAID",
  failed: "FAILED",
  error: "FAILED",
  rejected: "FAILED",
  declined: "FAILED",
  cancelled: "CANCELLED",
  canceled: "CANCELLED",
  expired: "CANCELLED",
  refunded: "REFUNDED",
};

function normaliseStatus(value: unknown): PaymentStatus {
  if (typeof value !== "string") return "PENDING";
  return STATUS_MAP[value.trim().toLowerCase()] ?? "PENDING";
}

function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (obj[key] != null) return obj[key];
  }
  return null;
}

async function gatewayFetch(
  cfg: GatewayConfig,
  path: string,
  init: { method: string; body?: string; signature?: string },
): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json",
    authorization: `Bearer ${cfg.apiKey}`,
    "x-merchant-id": cfg.merchantId,
  };
  if (init.signature) headers["x-signature"] = init.signature;

  let response: Response;
  try {
    response = await fetch(`${cfg.baseUrl}${path}`, {
      method: init.method,
      headers,
      ...(init.body === undefined ? {} : { body: init.body }),
    });
  } catch {
    throw new PaymentGatewayError("تعذر الاتصال ببوابة الدفع. حاول مرة أخرى.");
  }

  const text = await response.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    json = {};
  }

  if (!response.ok) {
    // Log status only — never the credentials or the full payload.
    console.error(`[payments] gateway responded ${response.status} for ${init.method} ${path}`);
    throw new PaymentGatewayError("رفضت بوابة الدفع الطلب. حاول مرة أخرى لاحقاً.");
  }

  return json;
}

export const algerianPaymentProvider: PaymentProvider = {
  id: "algerian-gateway",
  label: "بوابة الدفع الجزائرية",

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const cfg = readConfig();
    const payload = {
      merchant_id: cfg.merchantId,
      // Our reference doubles as the gateway-side idempotency key.
      reference: input.reference,
      idempotency_key: input.reference,
      amount: input.amount,
      currency: input.currency,
      description: input.description,
      customer: { name: input.customerName ?? null, email: input.customerEmail ?? null },
      return_url: input.returnUrl,
      callback_url: cfg.callbackUrl,
    };
    const body = JSON.stringify(payload);
    const json = await gatewayFetch(cfg, cfg.createPath, {
      method: "POST",
      body,
      signature: sign(cfg.secret, body),
    });

    const redirectUrl = pick(json, ["checkout_url", "payment_url", "redirect_url", "url", "form_url"]);
    if (typeof redirectUrl !== "string" || !redirectUrl) {
      throw new PaymentGatewayError("لم ترجع بوابة الدفع رابط الدفع.");
    }

    return {
      providerTransactionId: (pick(json, ["id", "transaction_id", "order_id", "payment_id"]) as string) ?? null,
      redirectUrl,
      status: normaliseStatus(pick(json, ["status", "state"])) || "PENDING",
      raw: json,
    };
  },

  async getPaymentStatus(reference, providerTransactionId) {
    const cfg = readConfig();
    const path = cfg.statusPath
      .replace("{id}", encodeURIComponent(providerTransactionId || reference))
      .replace("{reference}", encodeURIComponent(reference));
    const json = await gatewayFetch(cfg, path, { method: "GET" });

    const amount = pick(json, ["amount", "total"]);
    return {
      providerTransactionId:
        (pick(json, ["id", "transaction_id", "order_id", "payment_id"]) as string) ??
        providerTransactionId ??
        null,
      status: normaliseStatus(pick(json, ["status", "state"])),
      amount: amount == null ? null : Number(amount),
      currency: (pick(json, ["currency"]) as string) ?? null,
      raw: json,
    } satisfies PaymentSnapshot;
  },

  async verifyPayment(reference, providerTransactionId) {
    return algerianPaymentProvider.getPaymentStatus(reference, providerTransactionId);
  },

  async handleWebhook(rawBody: string, headers: Headers): Promise<WebhookVerificationResult> {
    const cfg = readConfig();
    const received = headers.get("x-signature") || headers.get("x-gateway-signature") || "";
    if (!received || !safeEqual(received, sign(cfg.secret, rawBody))) {
      throw new PaymentGatewayError("توقيع غير صالح.");
    }
    const json = JSON.parse(rawBody) as Record<string, unknown>;
    return {
      reference: (pick(json, ["reference", "merchant_reference", "order_reference"]) as string) ?? null,
      providerTransactionId:
        (pick(json, ["id", "transaction_id", "order_id", "payment_id"]) as string) ?? null,
      status: normaliseStatus(pick(json, ["status", "state"])),
      raw: json,
    };
  },
};
