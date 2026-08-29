import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, MapPin } from "lucide-react";

import { SiteFooter } from "@/components/hamla/site-footer";
import { SiteHeader } from "@/components/hamla/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CAMPAIGN_STATUS_BADGE, StatusBadge } from "@/components/hamla/status-badge";
import { formatDZD, formatDate } from "@/lib/format";
import { getPublicCharityBySlug } from "@/lib/server/charity/public-profile.server";

export const Route = createFileRoute("/charity-profile/$slug")({
  head: ({ params }) => [
    { title: `${params.slug} | حملة` },
  ],
  component: PublicCharityProfilePage,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-2xl font-bold">404</h1>
        <p className="mt-1 text-sm text-subtle-foreground">الجمعية غير موجودة</p>
      </div>
    </div>
  ),
});

function PublicCharityProfilePage() {
  const { slug } = Route.useParams();
  const fetch = useServerFn(getPublicCharityBySlug);
  const q = useQuery({
    queryKey: ["public-charity", slug],
    queryFn: () => fetch({ data: { slug } }),
  });

  if (q.isPending) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
          <Skeleton className="h-12 w-1/2" />
          <Skeleton className="mt-4 h-24 w-full" />
        </main>
        <SiteFooter />
      </div>
    );
  }
  if (q.isError || !q.data) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center">
          <h1 className="text-xl font-semibold">الجمعية غير موجودة</h1>
        </main>
        <SiteFooter />
      </div>
    );
  }
  const { charity, campaigns } = q.data;
  const totalRaised = campaigns.reduce((acc, c) => acc + Number(c.raised_amount ?? 0), 0);
  const totalDonors = campaigns.reduce((acc, c) => acc + Number(c.donor_count ?? 0), 0);
  const active = campaigns.filter((c) => c.status === "published").length;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">{charity.name}</h1>
              <p className="mt-1 inline-flex items-center gap-1 text-sm text-primary-strong">
                <BadgeCheck className="size-4" /> جهة موثقة من حملة
              </p>
              {charity.wilaya ? (
                <p className="mt-1 inline-flex items-center gap-1 text-sm text-subtle-foreground">
                  <MapPin className="size-3.5" /> {charity.wilaya}
                </p>
              ) : null}
            </div>
          </div>
          {charity.description ? <p className="mt-4 leading-relaxed text-sm">{charity.description}</p> : null}
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 text-center text-sm">
          <Card><CardContent className="p-4"><p className="text-subtle-foreground">إجمالي مُجمَّع</p><p className="mt-1 text-xl font-bold">{formatDZD(totalRaised)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-subtle-foreground">متبرعون</p><p className="mt-1 text-xl font-bold">{totalDonors}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-subtle-foreground">حملات نشطة</p><p className="mt-1 text-xl font-bold">{active}</p></CardContent></Card>
        </div>

        <h2 className="mt-8 text-lg font-semibold">الحملات</h2>
        {campaigns.length === 0 ? (
          <p className="mt-3 text-sm text-subtle-foreground">لا توجد حملات نشطة حالياً.</p>
        ) : (
          <div className="mt-3 grid gap-3">
            {campaigns.map((c) => {
              const sb = CAMPAIGN_STATUS_BADGE[c.status] ?? { label: c.status, kind: "info" as const };
              return (
                <Link key={c.id} to="/c/$slug" params={{ slug: c.slug }} className="block rounded-2xl border border-border bg-card p-4 transition hover:bg-secondary">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{c.title}</p>
                    <div className="flex items-center gap-2">
                      {c.certified ? <StatusBadge label="موثقة" kind="ok" /> : null}
                      <StatusBadge label={sb.label} kind={sb.kind} />
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-subtle-foreground">
                    {formatDZD(Number(c.raised_amount))} من {formatDZD(Number(c.goal_amount))} · {c.donor_count} متبرع · أُنشئت في {formatDate(c.created_at)}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
