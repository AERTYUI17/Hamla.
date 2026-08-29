import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CAMPAIGN_STATUS_BADGE, StatusBadge } from "@/components/hamla/status-badge";
import { formatDZD, formatDate } from "@/lib/format";
import { listMyCampaigns } from "@/lib/server/charity/campaigns.server";

export const Route = createFileRoute("/charity/campaigns")({
  head: () => ({ meta: [{ title: "حملاتي | حملة" }] }),
  component: MyCampaignsPage,
});

function MyCampaignsPage() {
  const fetch = useServerFn(listMyCampaigns);
  const q = useQuery({
    queryKey: ["my-campaigns"],
    queryFn: () => fetch({ data: {} }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">حملاتي</h1>
        <Button asChild>
          <Link to="/charity/campaigns/new">
            <Plus className="size-4" /> إنشاء حملة
          </Link>
        </Button>
      </div>

      {q.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : q.isError || !q.data ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-destructive">تعذر التحميل.</div>
      ) : q.data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-subtle-foreground">لم تنشئ أي حملة بعد.</p>
          <Button asChild className="mt-4">
            <Link to="/charity/campaigns/new">إنشاء أول حملة</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {q.data.map((c) => {
            const sb = CAMPAIGN_STATUS_BADGE[c.status] ?? { label: c.status, kind: "info" as const };
            return (
              <Link
                key={c.id}
                to="/charity/campaigns/$id"
                params={{ id: c.id }}
                className="block rounded-2xl border border-border bg-card p-4 transition hover:bg-secondary"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{c.title}</p>
                    <p className="mt-1 text-xs text-subtle-foreground">
                      {formatDZD(Number(c.raised_amount))} من {formatDZD(Number(c.goal_amount))} · {c.donor_count} متبرع · أُنشئت في {formatDate(c.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.certified ? <StatusBadge label="موثقة" kind="ok" /> : null}
                    <StatusBadge label={sb.label} kind={sb.kind} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
