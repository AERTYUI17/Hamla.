import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2,
  CheckCircle2,
  HandHeart,
  ScrollText,
  Users,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getAdminDashboardTotals } from "@/lib/server/admin/dashboard.server";
import { formatDZD, formatDate } from "@/lib/format";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "لوحة الإدارة | حملة" }] }),
  component: AdminHomePage,
});

const actionLabels: Record<string, string> = {
  approve_charity: "موافقة على جمعية",
  reject_charity: "رفض جمعية",
  suspend_charity: "تعليق جمعية",
  approve_campaign: "نشر/إعادة تفعيل حملة",
  reject_campaign: "رفض حملة",
  certify_campaign: "توثيق حملة",
  remove_certification: "إلغاء توثيق حملة",
  suspend_campaign: "تعليق حملة",
  approve_payout: "موافقة على سحب",
  reject_payout: "رفض سحب",
  mark_payout_paid: "تأكيد دفع سحب",
  suspend_user: "تعليق مستخدم",
  reactivate_user: "إعادة تفعيل مستخدم",
  view_charity_document: "عرض وثيقة جمعية",
};

function AdminHomePage() {
  const fetch = useServerFn(getAdminDashboardTotals);
  const q = useQuery({
    queryKey: ["admin-dashboard-totals"],
    queryFn: () => fetch({ data: {} }),
  });

  if (q.isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (q.isError || !q.data) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-destructive">
        تعذر تحميل لوحة الإدارة.
      </div>
    );
  }

  const d = q.data;
  const tiles: { title: string; value: string; icon: ReactNode; href?: string }[] = [
    { title: "إجمالي المستخدمين", value: d.users.total.toString(), icon: <Users className="size-5" /> },
    { title: "الجمعيات الموثقة", value: d.charities.approved.toString(), icon: <Building2 className="size-5" /> },
    { title: "طلبات جمعيات قيد المراجعة", value: d.charities.pendingApplications.toString(), icon: <ScrollText className="size-5" />, href: "/admin/charities" },
    { title: "إجمالي الحملات", value: d.campaigns.total.toString(), icon: <HandHeart className="size-5" /> },
    { title: "حملات قيد المراجعة", value: d.campaigns.submitted.toString(), icon: <HandHeart className="size-5" />, href: "/admin/campaigns" },
    { title: "حملات موثقة", value: d.campaigns.certified.toString(), icon: <CheckCircle2 className="size-5" /> },
    { title: "إجمالي التبرعات", value: formatDZD(d.donations.totalRaisedDzd), icon: <HandHeart className="size-5" /> },
    { title: "تبرعات آخر 24 ساعة", value: formatDZD(d.donations.last24hAmountDzd), icon: <HandHeart className="size-5" /> },
    { title: "طلبات سحب معلقة", value: d.payouts.pending.toString(), icon: <Wallet className="size-5" />, href: "/admin/payouts" },
    { title: "سحوبات هذا الشهر", value: formatDZD(d.payouts.totalPaidDzd), icon: <Wallet className="size-5" /> },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">الرئيسية</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => {
          const inner = (
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-subtle-foreground">{t.title}</CardTitle>
                <span className="text-primary-strong">{t.icon}</span>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{t.value}</p>
              </CardContent>
            </Card>
          );
          return t.href ? (
            <Link key={t.title} to={t.href} className="block">{inner}</Link>
          ) : (
            <div key={t.title}>{inner}</div>
          );
        })}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">النشاط الأخير</h2>
        <Card>
          <CardContent className="p-0">
            {d.recentActivity.length === 0 ? (
              <p className="p-6 text-sm text-subtle-foreground">لا يوجد نشاط بعد.</p>
            ) : (
              <ul className="divide-y divide-border">
                {d.recentActivity.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium">{actionLabels[a.action] ?? a.action}</p>
                      <p className="text-xs text-subtle-foreground">
                        {a.target_type} · {a.target_id.slice(0, 8)}…
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-subtle-foreground">
                      {formatDate(a.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
