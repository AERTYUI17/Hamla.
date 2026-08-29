import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock, FileText, Loader2, XCircle } from "lucide-react";

import { SiteFooter } from "@/components/hamla/site-footer";
import { SiteHeader } from "@/components/hamla/site-header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { getMyCharityApplication } from "@/lib/charity-applications.server";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/my-charity-application")({
  head: () => ({
    meta: [
      { title: "حالة طلب الجمعية | حملة" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyCharityApplicationPage,
});

const statusLabels: Record<string, { label: string; tone: "info" | "ok" | "warn" | "err" }> = {
  submitted: { label: "تم الاستلام — قيد المراجعة", tone: "info" },
  under_review: { label: "قيد المراجعة", tone: "info" },
  approved: { label: "تمت الموافقة", tone: "ok" },
  rejected: { label: "مرفوض", tone: "err" },
  more_info_required: { label: "مطلوب معلومات إضافية", tone: "warn" },
  suspended: { label: "موقوف", tone: "err" },
};

function MyCharityApplicationPage() {
  const { user, loading } = useAuth();
  const fetchApp = useServerFn(getMyCharityApplication);

  const query = useQuery({
    queryKey: ["my-charity-application"],
    queryFn: () => fetchApp({ data: {} }),
    enabled: Boolean(user),
  });

  const data = query.data;
  const meta = data ? statusLabels[data.status] ?? { label: data.status, tone: "info" as const } : null;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold">حالة طلب الجمعية</h1>

        {loading || (query.isPending && Boolean(user)) ? (
          <div className="mt-8 flex justify-center">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : !user ? (
          <div className="mt-8 rounded-2xl border border-border bg-card p-8 text-center">
            <h2 className="text-lg font-semibold">سجّل الدخول لعرض حالة طلبك</h2>
            <Button asChild className="mt-4">
              <Link to="/">العودة إلى الرئيسية</Link>
            </Button>
          </div>
        ) : !data ? (
          <div className="mt-8 rounded-2xl border border-border bg-card p-8 text-center">
            <FileText className="mx-auto size-10 text-subtle-foreground" />
            <h2 className="mt-4 text-lg font-semibold">لم تقدم طلباً بعد</h2>
            <p className="mt-2 text-sm text-subtle-foreground">
              قدّم طلبك للحصول على صفة جمعية خيرية لتبدأ حملاتك على منصة حملة.
            </p>
            <Button asChild className="mt-6">
              <Link to="/become-a-charity">قدّم طلباً</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-subtle-foreground">اسم الجمعية</p>
                  <p className="font-semibold">{data.org_name_ar}</p>
                </div>
                <div className="flex items-center gap-2">
                  {meta?.tone === "ok" ? (
                    <CheckCircle2 className="size-5 text-primary-strong" />
                  ) : meta?.tone === "err" ? (
                    <XCircle className="size-5 text-destructive" />
                  ) : (
                    <Clock className="size-5 text-highlight" />
                  )}
                  <span className="text-sm font-medium">{meta?.label}</span>
                </div>
              </div>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-subtle-foreground">تاريخ التقديم</dt>
                  <dd>{formatDate(data.submitted_at)}</dd>
                </div>
                {data.reviewed_at ? (
                  <div className="flex justify-between">
                    <dt className="text-subtle-foreground">تاريخ آخر مراجعة</dt>
                    <dd>{formatDate(data.reviewed_at)}</dd>
                  </div>
                ) : null}
              </dl>
            </div>

            {data.admin_notes ? (
              <div className="rounded-2xl border border-border bg-secondary p-6">
                <h3 className="text-sm font-semibold">ملاحظات فريق حملة</h3>
                <p className="mt-2 text-sm leading-relaxed">{data.admin_notes}</p>
              </div>
            ) : null}

            {data.status === "approved" ? (
              <div className="rounded-2xl border border-primary bg-primary-soft p-6 text-center">
                <p className="text-sm">تمت الموافقة على طلبك. يمكنك الآن استخدام لوحة تحكم الجمعية.</p>
                <Button asChild className="mt-4">
                  <Link to="/charity">الذهاب إلى لوحة التحكم</Link>
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
