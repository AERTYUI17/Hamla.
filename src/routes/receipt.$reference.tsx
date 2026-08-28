import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mail, Printer } from "lucide-react";
import { toast } from "sonner";

import { HamlaMark } from "@/components/hamla/logo";
import { SiteHeader } from "@/components/hamla/site-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { emailReceipt, getReceipt } from "@/lib/donations.functions";
import { PAYMENT_STATUS_LABEL, formatDZD, formatDate, formatTime } from "@/lib/format";

export const Route = createFileRoute("/receipt/$reference")({
  head: () => ({
    meta: [
      { title: "إيصال التبرع | حملة" },
      { name: "description", content: "إيصال تبرع رسمي برقم فريد صادر من منصة حملة." },
      { property: "og:title", content: "إيصال التبرع | حملة" },
      { property: "og:description", content: "إيصال تبرع رسمي برقم فريد صادر من منصة حملة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReceiptPage,
});

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-3 text-sm last:border-0">
      <span className="text-subtle-foreground">{label}</span>
      <span className="text-end font-medium">{value}</span>
    </div>
  );
}

function ReceiptPage() {
  const { reference } = Route.useParams();
  const { user, loading } = useAuth();
  const fetchReceipt = useServerFn(getReceipt);
  const sendEmail = useServerFn(emailReceipt);

  const receipt = useQuery({
    queryKey: ["receipt", reference],
    queryFn: () => fetchReceipt({ data: { reference } }),
    enabled: Boolean(user),
  });

  const emailMutation = useMutation({
    mutationFn: () => sendEmail({ data: { reference } }),
    onSuccess: (result) => toast.success(`تم إرسال الإيصال إلى ${result.to}`),
    onError: (error: Error) => toast.error(error.message),
  });

  const data = receipt.data;

  return (
    <div className="min-h-screen bg-secondary">
      <div className="print:hidden">
        <SiteHeader />
      </div>

      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        {loading || (receipt.isPending && Boolean(user)) ? (
          <div className="space-y-4 rounded-2xl bg-card p-8">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : !user ? (
          <div className="rounded-2xl bg-card p-8 text-center">
            <h1 className="text-lg font-semibold">سجّل الدخول لعرض الإيصال</h1>
            <p className="mt-2 text-sm text-subtle-foreground">
              الإيصالات خاصة ومتاحة لصاحب التبرع فقط.
            </p>
          </div>
        ) : receipt.isError ? (
          <div className="rounded-2xl bg-card p-8 text-center">
            <h1 className="text-lg font-semibold">الإيصال غير متوفر</h1>
            <p className="mt-2 text-sm text-subtle-foreground">
              {(receipt.error as Error).message}
            </p>
            <Button asChild variant="outline" className="mt-6">
              <Link to="/">العودة إلى الحملة</Link>
            </Button>
          </div>
        ) : data ? (
          <>
            <article className="rounded-2xl border border-border bg-card p-8 print:border-0 print:p-0">
              <header className="flex items-start justify-between gap-4 border-b border-border pb-6">
                <div className="flex items-center gap-2">
                  <HamlaMark className="h-9" />
                  <div>
                    <p className="font-semibold">حملة</p>
                    <p className="text-xs text-subtle-foreground">منصة التمويل الجماعي</p>
                  </div>
                </div>
                <div className="text-end">
                  <p className="text-xs text-subtle-foreground">إيصال تبرع</p>
                  <p className="font-mono text-sm font-semibold">
                    {data.invoiceNumber ?? data.reference}
                  </p>
                </div>
              </header>

              <div className="py-6">
                <p className="text-xs text-subtle-foreground">المبلغ المتبرع به</p>
                <p className="mt-1 text-3xl font-bold text-primary-strong">
                  {formatDZD(data.amount)}
                </p>
                <p className="mt-1 text-sm text-subtle-foreground">
                  {PAYMENT_STATUS_LABEL[data.status] ?? data.status}
                </p>
              </div>

              <div className="rounded-xl bg-secondary p-4 print:bg-transparent print:p-0">
                <Row label="الحملة" value={data.campaignTitle} />
                <Row label="المتبرع" value={data.donorName} />
                {data.donorEmail ? <Row label="البريد الإلكتروني" value={data.donorEmail} /> : null}
                <Row label="طريقة الدفع" value={data.providerLabel} />
                <Row label="مرجع العملية" value={data.reference} />
                <Row
                  label="تاريخ التبرع"
                  value={`${formatDate(data.paidAt)} — ${formatTime(data.paidAt)}`}
                />
                {data.issuedAt ? (
                  <Row label="تاريخ إصدار الإيصال" value={formatDate(data.issuedAt)} />
                ) : null}
              </div>

              {data.message ? (
                <div className="mt-6">
                  <p className="text-xs text-subtle-foreground">رسالة المتبرع</p>
                  <p className="mt-1 text-sm leading-relaxed">{data.message}</p>
                </div>
              ) : null}

              <footer className="mt-8 border-t border-border pt-4 text-xs leading-relaxed text-subtle-foreground">
                هذا الإيصال صادر إلكترونياً من منصة حملة ويُعتبر وثيقة إثبات للتبرع. يُرجى
                الاحتفاظ برقم الإيصال للمراجعة.
              </footer>
            </article>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row print:hidden">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => window.print()}
              >
                <Printer className="size-4" />
                طباعة أو حفظ PDF
              </Button>
              <Button
                className="flex-1"
                disabled={data.status !== "PAID" || emailMutation.isPending}
                onClick={() => emailMutation.mutate()}
              >
                {emailMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Mail className="size-4" />
                )}
                إرسال إلى البريد الإلكتروني
              </Button>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
