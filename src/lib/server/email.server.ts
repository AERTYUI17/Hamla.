/**
 * Email service abstraction. SERVER ONLY.
 *
 * Credentials live in the server environment (RESEND_API_KEY) and are never
 * exposed to the browser. When no provider is configured the call reports it
 * instead of pretending an email was sent.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

export interface EmailResult {
  sent: boolean;
  reason?: string;
}

export interface EmailProvider {
  readonly id: string;
  send(message: EmailMessage): Promise<EmailResult>;
}

const resendProvider: EmailProvider = {
  id: "resend",
  async send(message) {
    const apiKey = process.env["RESEND_API_KEY"];
    if (!apiKey) return { sent: false, reason: "not_configured" };
    const from = process.env["EMAIL_FROM"] || "HAMLA <onboarding@resend.dev>";

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ from, to: [message.to], subject: message.subject, html: message.html }),
      });
      if (!res.ok) {
        console.error(`[email] provider responded ${res.status}`);
        return { sent: false, reason: "provider_error" };
      }
      return { sent: true };
    } catch {
      return { sent: false, reason: "network_error" };
    }
  },
};

export function getEmailProvider(): EmailProvider {
  return resendProvider;
}

export function receiptEmailHtml(input: {
  donorName: string;
  campaignTitle: string;
  amountLabel: string;
  invoiceNumber: string;
  reference: string;
  dateLabel: string;
  receiptUrl: string;
}): string {
  return `<!doctype html><html dir="rtl" lang="ar"><body style="margin:0;background:#fcfcfc;font-family:'IBM Plex Sans Arabic',Arial,sans-serif;color:#171717">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <div style="font-size:22px;font-weight:700;color:#116a48">HAMLA · حملة</div>
    <div style="height:1px;background:#e2e2e2;margin:20px 0"></div>
    <h1 style="font-size:20px;margin:0 0 8px">شكراً لك على تبرعك</h1>
    <p style="line-height:1.9;margin:0 0 20px;color:#404040">تم تسجيل تبرعك بنجاح، وهذه تفاصيل الإيصال.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr><td style="padding:8px 0;color:#6e6e6e">المتبرع</td><td style="padding:8px 0;text-align:left">${input.donorName}</td></tr>
      <tr><td style="padding:8px 0;color:#6e6e6e">الحملة</td><td style="padding:8px 0;text-align:left">${input.campaignTitle}</td></tr>
      <tr><td style="padding:8px 0;color:#6e6e6e">المبلغ</td><td style="padding:8px 0;text-align:left;font-weight:700">${input.amountLabel}</td></tr>
      <tr><td style="padding:8px 0;color:#6e6e6e">رقم الإيصال</td><td style="padding:8px 0;text-align:left">${input.invoiceNumber}</td></tr>
      <tr><td style="padding:8px 0;color:#6e6e6e">رقم العملية</td><td style="padding:8px 0;text-align:left">${input.reference}</td></tr>
      <tr><td style="padding:8px 0;color:#6e6e6e">حالة الدفع</td><td style="padding:8px 0;text-align:left">مدفوع</td></tr>
      <tr><td style="padding:8px 0;color:#6e6e6e">التاريخ</td><td style="padding:8px 0;text-align:left">${input.dateLabel}</td></tr>
    </table>
    <div style="height:1px;background:#e2e2e2;margin:20px 0"></div>
    <a href="${input.receiptUrl}" style="display:inline-block;background:#72e3ad;color:#143024;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">عرض الإيصال</a>
    <p style="margin-top:28px;color:#6e6e6e;font-size:13px">شكراً لمساهمتك في دعم هذه الحملة.</p>
  </div></body></html>`;
}
