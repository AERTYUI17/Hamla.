import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pause, Play, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CAMPAIGN_STATUS_BADGE, StatusBadge } from "@/components/hamla/status-badge";
import { formatDZD, formatDate } from "@/lib/format";
import { getMyCampaign, setMyCampaignStatus } from "@/lib/server/charity/campaigns.server";

export const Route = createFileRoute("/charity/campaigns/$id")({
  head: () => ({ meta: [{ title: "إدارة حملة | حملة" }] }),
  component: MyCampaignPage,
});

function MyCampaignPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const fetch = useServerFn(getMyCampaign);
  const setStatus = useServerFn(setMyCampaignStatus);

  const q = useQuery({
    queryKey: ["my-campaign", id],
    queryFn: () => fetch({ data: { id } }),
  });
  const pauseMut = useMutation({
    mutationFn: () => setStatus({ data: { id, to: "paused" } }),
    onSuccess: () => { toast.success("تم إيقاف الحملة مؤقتاً."); void qc.invalidateQueries({ queryKey: ["my-campaign", id] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const resumeMut = useMutation({
    mutationFn: () => setStatus({ data: { id, to: "published" } }),
    onSuccess: () => { toast.success("تمت إعادة التفعيل."); void qc.invalidateQueries({ queryKey: ["my-campaign", id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isPending) return <Skeleton className="h-64 w-full" />;
  if (q.isError || !q.data) return <div className="rounded-2xl border border-border bg-card p-6 text-sm text-destructive">تعذر التحميل.</div>;
  const c: any = q.data.campaign;
  const donations = q.data.donations;
  const sb = CAMPAIGN_STATUS_BADGE[c.status] ?? { label: c.status, kind: "info" as const };
  const isPublished = c.status === "published";
  const isPaused = c.status === "paused";
  const isSubmitted = c.status === "submitted";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/charity/campaigns" className="text-xs text-subtle-foreground hover:underline">← العودة</Link>
          <h1 className="mt-1 text-2xl font-bold">{c.title}</h1>
          <p className="text-sm text-subtle-foreground">slug: <span className="font-mono">{c.slug}</span></p>
        </div>
        <div className="flex items-center gap-2">
          {c.certified ? <StatusBadge label="موثقة" kind="ok" /> : null}
          <StatusBadge label={sb.label} kind={sb.kind} />
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>المعلومات</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="الهدف" value={formatDZD(Number(c.goal_amount))} />
          <Row label="المُجمَّع" value={formatDZD(Number(c.raised_amount))} />
          <Row label="المتبرعون" value={String(c.donor_count)} />
          <Row label="الفئة" value={c.category ?? "—"} />
          <Row label="الولاية / الموقع" value={c.location ?? "—"} />
          <Row label="تاريخ الإنشاء" value={formatDate(c.created_at)} />
        </CardContent>
      </Card>

      {isSubmitted ? (
        <div className="rounded-2xl border border-highlight bg-highlight-soft p-4 text-sm text-highlight-foreground">
          حملتك قيد المراجعة من قبل إدارة حملة. سيتم إخطارك فور اتخاذ القرار.
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {isPublished || isPaused ? (
          isPublished ? (
            <Button variant="outline" onClick={() => pauseMut.mutate()} disabled={pauseMut.isPending}>
              {pauseMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Pause className="size-4" />} إيقاف مؤقت
            </Button>
          ) : (
            <Button onClick={() => resumeMut.mutate()} disabled={resumeMut.isPending}>
              {resumeMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} إعادة التفعيل
            </Button>
          )
        ) : null}
      </div>

      <Card>
        <CardHeader><CardTitle>آخر التبرعات</CardTitle></CardHeader>
        <CardContent>
          {donations.length === 0 ? (
            <p className="text-sm text-subtle-foreground">لا توجد تبرعات بعد.</p>
          ) : (
            <ul className="divide-y divide-border">
              {donations.map((d: any) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{d.anonymous ? "متبرع مجهول" : (d.donor_name ?? "—")}</p>
                    <p className="font-mono text-[10px] text-subtle-foreground">{d.reference}</p>
                  </div>
                  <div className="text-end">
                    <p className="font-mono">{formatDZD(Number(d.amount))}</p>
                    <p className="text-[10px] text-subtle-foreground">{formatDate(d.paid_at ?? d.created_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border py-2 last:border-0">
      <span className="shrink-0 text-subtle-foreground">{label}</span>
      <span className="text-end font-medium">{value}</span>
    </div>
  );
}
