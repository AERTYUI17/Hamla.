import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle2, Download, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/hamla/confirm-dialog";
import { APP_STATUS_BADGE, StatusBadge } from "@/components/hamla/status-badge";
import { formatDate } from "@/lib/format";
import {
  approveCharityApplication,
  getCharityApplication,
  getCharityDocumentSignedUrl,
  rejectCharityApplication,
  requestMoreInfo,
} from "@/lib/server/admin/charities.server";

export const Route = createFileRoute("/admin/charities/$id")({
  head: () => ({ meta: [{ title: "تفاصيل طلب جمعية | حملة" }] }),
  component: AdminCharityDetailPage,
});

type ActionKind = "approve" | "reject" | "more_info" | null;

function AdminCharityDetailPage() {
  const { id } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();

  const fetchDetail = useServerFn(getCharityApplication);
  const approve = useServerFn(approveCharityApplication);
  const reject = useServerFn(rejectCharityApplication);
  const moreInfo = useServerFn(requestMoreInfo);
  const getDocUrl = useServerFn(getCharityDocumentSignedUrl);

  const q = useQuery({
    queryKey: ["admin-charity-application", id],
    queryFn: () => fetchDetail({ data: { id } }),
  });

  const [dialog, setDialog] = useState<ActionKind>(null);

  const invalidateAll = () => {
    void qc.invalidateQueries({ queryKey: ["admin-charity-application", id] });
    void qc.invalidateQueries({ queryKey: ["admin-charity-applications"] });
    void qc.invalidateQueries({ queryKey: ["admin-dashboard-totals"] });
  };

  const approveMut = useMutation({
    mutationFn: () => approve({ data: { id, notes: null } }),
    onSuccess: () => {
      toast.success("تمت الموافقة على الطلب.");
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectMut = useMutation({
    mutationFn: (reason: string) => reject({ data: { id, reason } }),
    onSuccess: () => {
      toast.success("تم رفض الطلب.");
      invalidateAll();
      setDialog(null);
      void router.navigate({ to: "/admin/charities" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const moreInfoMut = useMutation({
    mutationFn: (notes: string) => moreInfo({ data: { id, notes } }),
    onSuccess: () => {
      toast.success("تم إرسال طلب المعلومات الإضافية.");
      invalidateAll();
      setDialog(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const downloadMut = useMutation({
    mutationFn: (documentId: string) => getDocUrl({ data: { documentId } }),
    onSuccess: (res) => {
      window.open(res.url, "_blank", "noopener,noreferrer");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (q.isError || !q.data) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-destructive">
        تعذر تحميل الطلب.
      </div>
    );
  }

  const a = q.data.application;
  const docs = q.data.documents;
  const badge = APP_STATUS_BADGE[a.status] ?? { label: a.status, kind: "info" as const };
  const acting = approveMut.isPending || rejectMut.isPending || moreInfoMut.isPending;
  const finalStates = ["approved", "rejected", "suspended"].includes(a.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/admin/charities" className="text-xs text-subtle-foreground hover:underline">
            ← العودة إلى قائمة الطلبات
          </Link>
          <h1 className="mt-1 text-2xl font-bold">{a.org_name_ar}</h1>
          <p className="text-sm text-subtle-foreground">{a.org_name}</p>
        </div>
        <StatusBadge label={badge.label} kind={badge.kind} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>معلومات الجمعية</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="الفئة" value={a.org_category} />
            <Row label="الولاية" value={a.org_wilaya} />
            <Row label="البلدية" value={a.org_commune} />
            <Row label="العنوان" value={a.org_address} />
            <Row label="هاتف" value={a.org_phone} />
            <Row label="البريد الإلكتروني" value={a.org_email} />
            {a.org_website ? <Row label="الموقع" value={a.org_website} /> : null}
            <Row label="رقم التسجيل" value={a.registration_number} />
            <Row label="تاريخ التسجيل" value={formatDate(a.registration_date)} />
            <div className="pt-2">
              <p className="text-xs text-subtle-foreground">الوصف</p>
              <p className="mt-1 leading-relaxed">{a.org_description}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>الممثل</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="الاسم" value={a.rep_name} />
            <Row label="الهاتف" value={a.rep_phone} />
            <Row label="البريد" value={a.rep_email} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>الوثائق المرفقة</CardTitle>
        </CardHeader>
        <CardContent>
          {docs.length === 0 ? (
            <p className="text-sm text-subtle-foreground">لا توجد وثائق.</p>
          ) : (
            <ul className="divide-y divide-border">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium">{d.original_filename ?? d.type}</p>
                    <p className="text-xs text-subtle-foreground">
                      {d.mime_type} · {Math.round(d.size_bytes / 1024)} KB
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadMut.mutate(d.id)}
                    disabled={downloadMut.isPending}
                  >
                    <Download className="size-4" />
                    تحميل
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {!finalStates ? (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => approveMut.mutate()} disabled={acting}>
            {approveMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            قبول
          </Button>
          <Button variant="destructive" onClick={() => setDialog("reject")} disabled={acting}>
            <XCircle className="size-4" />
            رفض
          </Button>
          <Button variant="outline" onClick={() => setDialog("more_info")} disabled={acting}>
            طلب معلومات إضافية
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={dialog === "reject"}
        onOpenChange={(v) => setDialog(v ? "reject" : null)}
        title="رفض طلب الجمعية"
        description="سيتم إبلاغ المتقدم بالرفض والسبب. لا يمكن التراجع."
        requireReason
        reasonLabel="سبب الرفض"
        destructive
        confirmLabel="تأكيد الرفض"
        loading={rejectMut.isPending}
        onConfirm={(reason) => reason ? rejectMut.mutate(reason) : null}
      />

      <ConfirmDialog
        open={dialog === "more_info"}
        onOpenChange={(v) => setDialog(v ? "more_info" : null)}
        title="طلب معلومات إضافية"
        description="سيتم إرسال ملاحظاتك للمتقدم ليقوم بتحديث طلبه."
        requireReason
        reasonLabel="المعلومات المطلوبة"
        confirmLabel="إرسال الطلب"
        loading={moreInfoMut.isPending}
        onConfirm={(notes) => notes ? moreInfoMut.mutate(notes) : null}
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
