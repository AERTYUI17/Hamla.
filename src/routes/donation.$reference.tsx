import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";

import { SiteFooter } from "@/components/hamla/site-footer";
import { SiteHeader } from "@/components/hamla/site-header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { verifyDonation } from "@/lib/donations.functions";

export const Route = createFileRoute("/donation/$reference")({
  head: () => ({
    meta: [
      { title: "تأكيد التبرع | حملة" },
      { name: "description", content: "تأكيد حالة الدفع وإصدار إيصال التبرع على منصة حملة." },
      { property: "og:title", content: "تأكيد التبرع | حملة" },
      { property: "og:description", content: "تأكيد حالة الدفع وإصدار إيصال التبرع." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DonationStatusPage,
});

function DonationStatusPage() {
  const { reference } = Route.useParams();
  const { user, loading } = useAuth();
  const verify = useServerFn(verifyDonation);

  const status = useQuery({
    queryKey: ["donation-status", reference],
    queryFn: () => verify({ data: { reference } }),
    enabled: Boolean(user),
    refetchInterval: (query) =>
      query.state.data && query.state.data.status !== "PENDING" ? false : 4000,
  });

  const state = status.data?.status;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          {loading || (status.isPending && Boolean(user)) ? (
            <Pending title="جاري التحقق من الدفع…" text="لحظات فقط، نتواصل مع بوابة الدفع." />
          ) : !user ? (
            <div>
              <h1 className="text-lg font-semibold">سجّل الدخول لعرض حالة التبرع</h1>
              <p className="mt-2 text-sm text-subtle-foreground">
                حالة التبرع مرتبطة بحسابك للحفاظ على خصوصية بياناتك.
              </p>
            </div>
          ) : status.isError ? (
            <div>
              <XCircle className="mx-auto size-12 text-destructive" />
              <h1 className="mt-4 text-lg font-semibold">تعذر التحقق من التبرع</h1>
              <p className="mt-2 text-sm text-subtle-foreground">
                {(status.error as Error).message}
              </p>
              <Button className="mt-6" variant="outline" onClick={() => status.refetch()}>
                إعادة المحاولة
              </Button>
            </div>
          ) : state === "PAID" ? (
            <div>
              <CheckCircle2 className="mx-auto size-12 text-primary-strong" />
              <h1 className="mt-4 text-xl font-bold">تم تأكيد تبرعك، شكراً لك!</h1>
              <p className="mt-2 text-sm text-subtle-foreground">
                رقم الإيصال: {status.data?.invoiceNumber ?? reference}
              </p>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Button asChild>
                  <Link to="/receipt/$reference" params={{ reference }}>
                    عرض الإيصال
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/">العودة إلى الحملة</Link>
                </Button>
              </div>
            </div>
          ) : state === "PENDING" ? (
            <Pending
              title="الدفع قيد المعالجة"
              text="لم تُؤكَّد العملية بعد. نحدّث الحالة تلقائياً كل بضع ثوانٍ."
            />
          ) : (
            <div>
              <XCircle className="mx-auto size-12 text-destructive" />
              <h1 className="mt-4 text-lg font-semibold">
                {state === "CANCELLED" ? "تم إلغاء عملية الدفع" : "لم تكتمل عملية الدفع"}
              </h1>
              <p className="mt-2 text-sm text-subtle-foreground">
                لم يُخصم أي مبلغ. يمكنك المحاولة مرة أخرى من صفحة الحملة.
              </p>
              <Button asChild className="mt-6">
                <Link to="/">المحاولة مرة أخرى</Link>
              </Button>
            </div>
          )}

          <p className="mt-8 text-xs text-subtle-foreground">مرجع العملية: {reference}</p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Pending({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary-soft">
        <Loader2 className="size-6 animate-spin text-primary-strong" />
      </span>
      <h1 className="mt-4 text-lg font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-subtle-foreground">{text}</p>
      <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-subtle-foreground">
        <Clock className="size-3.5" />
        لا تُغلق هذه الصفحة
      </p>
    </div>
  );
}
