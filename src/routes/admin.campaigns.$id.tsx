import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck, ShieldOff, XCircle, Play, Pause, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/hamla/confirm-dialog";
import { CAMPAIGN_STATUS_BADGE, StatusBadge } from "@/components/hamla/status-badge";
import { formatDZD, formatDate } from "@/lib/format";
import {
  certifyCampaign,
  getAdminCampaign,
  publishCampaign,
  reactivateCampaign,
  rejectCampaign,
  removeCampaignCertification,
  suspendCampaign,
} from "@/lib/server/admin/campaigns.server";

export const Route = createFileRoute("/admin/campaigns/$id")({
  head: () => ({ meta: [{ title: "تفاصيل حملة | حملة" }] }),
  component: AdminCampaignDetailPage,
});

type ActionKind = "reject" | "suspend" | "remove_cert" | null;

function AdminCampaignDetailPage() {
  const { id } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();

  const fetchDetail = useServerFn(getAdminCampaign);
  const publish = useServerFn(publishCampaign);
  const reject = useServerFn(rejectCampaign);
  const suspend = useServerFn(suspendCampaign);
  const reactivate = useServerFn(reactivateCampaign);
  const certify = useServerFn(certifyCampaign);
  const removeCert = useServerFn(removeCampaignCertification);

  const q = useQuery({
    queryKey: ["admin-campaign", id],
    queryFn: () => fetchDetail({ data: { id } }),
  });

  const [dialog, setDialog] = useState<ActionKind>(null);

  const invalidateAll = () => {
    void qc.invalidateQueries({ queryKey: ["admin-campaign", id] });
    void qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
    void qc.invalidateQueries({ queryKey: ["admin-dashboard-totals"] });
  };

  const publishMut = useMutation({
    mutationFn: () => publish({ data: { id } }),
    onSuccess: () => { toast.success("تم نشر الحملة."); invalidateAll(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const rejectMut = useMutation({
    mutationFn: (reason: string) => reject({ data: { id, reason } }),
    onSuccess: () => {
      toast.success("تم رفض الحملة.");
      invalidateAll(); setDialog(null);
      void router.navigate({ to: "/admin/campaigns" });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const suspendMut = useMutation({
    mutationFn: (reason: string) => suspend({ data: { id, reason } }),
    onSuccess: () => { toast.success("تم تعليق الحملة."); invalidateAll(); setDialog(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const reactivateMut = useMutation({
    mutationFn: () => reactivate({ data: { id } }),
    onSuccess: () => { toast.success("تمت إعادة التفعيل."); invalidateAll(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const certifyMut = useMutation({
    mutationFn: () => certify({ data: { id } }),
    onSuccess: () => { toast.success("تم توثيق الحملة."); invalidateAll(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeCertMut = useMutation({
    mutationFn: (reason: string) => removeCert({ data: { id, reason } }),
    onSuccess: () => { toast.success("تم إلغاء التوثيق."); invalidateAll(); setDialog(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isPending) {
    return <Skeleton className="h-64 w-full" />;
  }
  if (q.isError || !q.data) {
    return <div className="rounded-2xl border border-border bg-card p-6 text-sm text-destructive">تعذر التحميل.</div>;
  }
  const c: any = q.data.campaign;
  const sb = CAMPAIGN_STATUS_BADGE[c.status] ?? { label: c.status, kind: "info" as const };
  const isPublished = c.status === "published";
  const isSuspended = c.status === "suspended";
  const isSubmitted = c.status === "submitted";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/admin/campaigns" className="text-xs text-subtle-foreground hover:underline">← العودة</Link>
          <h1 className="mt-1 text-2xl font-bold">{c.title}</h1>
          <p className="text-sm text-subtle-foreground">{c.charity_groups?.name ?? "—"}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge label={sb.label} kind={sb.kind} />
          {c.certified ? <StatusBadge label="موثقة" kind="ok" /> : <StatusBadge label="غير موثقة" kind="muted" />}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>المعلومات</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="الهدف" value={formatDZD(Number(c.goal_amount))} />
          <Row label="المُجمَّع" value={formatDZD(Number(c.raised_amount))} />
          <Row label="المتبرعون" value={String(c.donor_count)} />
          <Row label="الفئة" value={c.category ?? "—"} />
          <Row label="الولاية" value={c.location ?? "—"} />
          <Row label="تاريخ الإنشاء" value={formatDate(c.created_at)} />
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {(isSubmitted || c.status === "draft") ? (
          <Button onClick={() => publishMut.mutate()} disabled={publishMut.isPending}>
            {publishMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} نشر
          </Button>
        ) : null}
        {isSubmitted ? (
          <Button variant="destructive" onClick={() => setDialog("reject")}><XCircle className="size-4" /> رفض</Button>
        ) : null}
        {(isPublished || c.status === "paused") ? (
          <Button variant="outline" onClick={() => setDialog("suspend")}><Pause className="size-4" /> تعليق</Button>
        ) : null}
        {isSuspended ? (
          <Button variant="outline" onClick={() => reactivateMut.mutate()} disabled={reactivateMut.isPending}>
            {reactivateMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} إعادة التفعيل
          </Button>
        ) : null}
        {c.certified ? (
          <Button variant="outline" onClick={() => setDialog("remove_cert")}>
            <ShieldOff className="size-4" /> إلغاء التوثيق
          </Button>
        ) : (
          <Button onClick={() => certifyMut.mutate()} disabled={certifyMut.isPending}>
            {certifyMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} توثيق
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={dialog === "reject"}
        onOpenChange={(v) => setDialog(v ? "reject" : null)}
        title="رفض الحملة"
        description="سيتم إبلاغ الجمعية بالرفض. لا يمكن التراجع."
        requireReason
        reasonLabel="سبب الرفض"
        destructive
        confirmLabel="تأكيد الرفض"
        loading={rejectMut.isPending}
        onConfirm={(r) => r ? rejectMut.mutate(r) : null}
      />
      <ConfirmDialog
        open={dialog === "suspend"}
        onOpenChange={(v) => setDialog(v ? "suspend" : null)}
        title="تعليق الحملة"
        description="سيتم إيقاف الحملة مؤقتاً وإخفاءها عن المتبرعين."
        requireReason
        reasonLabel="سبب التعليق"
        destructive
        confirmLabel="تأكيد التعليق"
        loading={suspendMut.isPending}
        onConfirm={(r) => r ? suspendMut.mutate(r) : null}
      />
      <ConfirmDialog
        open={dialog === "remove_cert"}
        onOpenChange={(v) => setDialog(v ? "remove_cert" : null)}
        title="إلغاء توثيق الحملة"
        description="سيتم إزالة شارة التوثيق من الحملة."
        requireReason
        reasonLabel="سبب الإلغاء"
        confirmLabel="تأكيد الإلغاء"
        loading={removeCertMut.isPending}
        onConfirm={(r) => r ? removeCertMut.mutate(r) : null}
      />
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
