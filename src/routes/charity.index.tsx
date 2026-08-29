import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, ListChecks } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BalanceGrid } from "@/components/hamla/balance-card";
import { CAMPAIGN_STATUS_BADGE, StatusBadge } from "@/components/hamla/status-badge";
import { formatDZD, formatDate } from "@/lib/format";
import { getCharityDashboard } from "@/lib/server/charity/dashboard.server";

export const Route = createFileRoute("/charity/")({
  head: () => ({ meta: [{ title: "لوحة تحكم الجمعية | حملة" }] }),
  component: CharityDashboardPage,
});

const ledgerTypeLabels: Record<string, string> = {
  donation: "تبرع",
  payment_fee: "رسوم دفع",
  platform_fee: "رسوم منصة",
  refund: "استرداد",
  payout: "سحب",
  payout_fee: "رسوم سحب",
  adjustment: "تعديل",
};

function CharityDashboardPage() {
  const fetch = useServerFn(getCharityDashboard);
  const q = useQuery({
    queryKey: ["charity-dashboard"],
    queryFn: () => fetch({ data: {} }),
  });

  if (q.isPending) {
    return <div className="space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}</div>;
  }
  if (q.isError || !q.data) {
    return <div className="rounded-2xl border border-border bg-card p-6 text-sm text-destructive">تعذر التحميل.</div>;
  }
  const { charity, balances, recentCampaigns, recentLedger } = q.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">مرحباً، {charity?.name}</h1>
          <p className="text-sm text-subtle-foreground">إليك نظرة سريعة على حملاتك وأموالك.</p>
        </div>
        <Button asChild>
          <Link to="/charity/campaigns/new">
            <Plus className="size-4" /> إنشاء حملة
          </Link>
        </Button>
      </div>

      <BalanceGrid balances={balances} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>آخر الحملات</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/charity/campaigns">عرض الكل</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentCampaigns.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-subtle-foreground">
                لم تنشئ أي حملة بعد.
              </div>
            ) : (
              recentCampaigns.map((c) => {
                const sb = CAMPAIGN_STATUS_BADGE[c.status] ?? { label: c.status, kind: "info" as const };
                return (
                  <Link
                    key={c.id}
                    to="/charity/campaigns/$id"
                    params={{ id: c.id }}
                    className="block rounded-lg border border-border p-3 hover:bg-secondary"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{c.title}</p>
                      <StatusBadge label={sb.label} kind={sb.kind} />
                    </div>
                    <p className="mt-1 text-xs text-subtle-foreground">
                      {formatDZD(Number(c.raised_amount))} من {formatDZD(Number(c.goal_amount))} · {c.donor_count} متبرع
                    </p>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>النشاط المالي الأخير</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/charity/payouts">السحوبات</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentLedger.length === 0 ? (
              <p className="text-sm text-subtle-foreground">لا يوجد نشاط بعد.</p>
            ) : (
              recentLedger.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium">{ledgerTypeLabels[l.type] ?? l.type}</p>
                    <p className="text-xs text-subtle-foreground">{formatDate(l.created_at)}</p>
                  </div>
                  <p className={`font-mono ${Number(l.amount) >= 0 ? "text-primary-strong" : "text-destructive"}`}>
                    {Number(l.amount) >= 0 ? "+" : ""}
                    {formatDZD(Number(l.amount))}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
