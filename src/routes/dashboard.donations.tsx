import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Receipt } from "lucide-react";

import { SiteFooter } from "@/components/hamla/site-footer";
import { SiteHeader } from "@/components/hamla/site-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/hamla/status-badge";
import { formatDZD, formatDate } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { listMyDonations } from "@/lib/server/donor/donations.server";

export const Route = createFileRoute("/dashboard/donations")({
  head: () => ({ meta: [{ title: "تبرعاتي | حملة" }] }),
  component: MyDonationsPage,
});

function MyDonationsPage() {
  const { user, loading } = useAuth();
  const fetch = useServerFn(listMyDonations);
  const q = useQuery({
    queryKey: ["my-donations"],
    queryFn: () => fetch({ data: {} }),
    enabled: Boolean(user),
  });

  if (loading) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-4 py-10"><Skeleton className="h-40 w-full" /></main>
        <SiteFooter />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-xl font-semibold">سجّل الدخول لعرض تبرعاتك</h1>
          <Button asChild className="mt-4"><Link to="/">العودة إلى الرئيسية</Link></Button>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold">تبرعاتي</h1>

        {q.isPending ? (
          <Skeleton className="mt-6 h-40 w-full" />
        ) : q.isError || !q.data ? (
          <div className="mt-6 rounded-2xl border border-border bg-card p-6 text-sm text-destructive">تعذر التحميل.</div>
        ) : q.data.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <p className="text-sm text-subtle-foreground">لم تبرع بأي حملة بعد.</p>
            <Button asChild className="mt-4">
              <Link to="/c">تصفّح الحملات</Link>
            </Button>
          </div>
        ) : (
          <ul className="mt-6 space-y-2">
            {q.data.map((d: any) => (
              <li key={d.id} className="rounded-2xl border border-border bg-card p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link
                      to="/c/$slug"
                      params={{ slug: d.campaigns?.slug ?? "" }}
                      className="font-semibold hover:underline"
                    >
                      {d.campaigns?.title ?? "(حملة محذوفة)"}
                    </Link>
                    <p className="mt-1 font-mono text-[10px] text-subtle-foreground">{d.reference}</p>
                    <p className="text-xs text-subtle-foreground">{formatDate(d.paid_at ?? d.created_at)}</p>
                  </div>
                  <div className="text-end">
                    <p className="font-mono font-semibold">{formatDZD(Number(d.amount))}</p>
                    <div className="mt-1">
                      <StatusBadge
                        label={d.status}
                        kind={d.status === "PAID" ? "ok" : d.status === "FAILED" ? "err" : "info"}
                      />
                    </div>
                    {d.status === "PAID" ? (
                      <Button asChild size="sm" variant="outline" className="mt-2">
                        <Link to="/receipt/$reference" params={{ reference: d.reference }}>
                          <Receipt className="size-4" /> الإيصال
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
