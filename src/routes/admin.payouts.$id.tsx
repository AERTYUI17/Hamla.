import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/hamla/confirm-dialog";
import { PAYOUT_STATUS_BADGE, StatusBadge } from "@/components/hamla/status-badge";
import { formatDZD, formatDate } from "@/lib/format";
import {
  approvePayout,
  getAdminPayout,
  markPayoutPaid,
  rejectPayout,
} from "@/lib/server/admin/payouts.server";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/payouts/$id")({
  head: () => ({ meta: [{ title: "تفاصيل سحب | حملة" }] }),
  component: AdminPayoutDetailPage,
});

type ActionKind = "reject" | "mark_paid" | null;

function AdminPayoutDetailPage() {
  const { id } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();

  const fetchDetail = useServerFn(getAdminPayout);
  const approve = useServerFn(approvePayout);
  const reject = useServerFn(rejectPayout);
  const markPaid = useServerFn(markPayoutPaid);

  const q = useQuery({
    queryKey: ["admin-payout", id],
    queryFn: () => fetchDetail({ data: { id } }),
  });

  const [dialog, setDialog] = useState<ActionKind>(null);
  const [externalRef, setExternalRef] = useState("");

  const invalidateAll = () => {
    void qc.invalidateQueries({ queryKey: ["admin-payout", id] });
    void qc.invalidateQueries({ queryKey: ["admin-payouts"] });
    void qc.invalidateQueries({ queryKey: ["admin-dashboard-totals"] });
  };

  const approveMut = useMutation({
    mutationFn: () => approve({ data: { id } }),
    onSuccess: () => { toast.success("تمت الموافقة."); invalidateAll(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const rejectMut = useMutation({
    mutationFn: (reason: string) => reject({ data: { id, reason } }),
    onSuccess: () => { toast.success("تم الرفض."); invalidateAll(); setDialog(null); void router.navigate({ to: "/admin/payouts" }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const markPaidMut = useMutation({
    mutationFn: (ref: string) => markPaid({ data: { id, external_reference: ref } }),
    onSuccess: () => { toast.success("تم تأكيد الدفع."); invalidateAll(); setDialog(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isPending) return <Skeleton className="h-64 w-full" />;
  if (q.isError || !q.data) return <div className="rounded-2xl border border-border bg-card p-6 text-sm text-destructive">تعذر التحميل.</div>;

  const p: any = q.data;
  const sb = PAYOUT_STATUS_BADGE[p.status] ?? { label: p.status, kind: "info" as const };
  const dest = (p.destination ?? {}) as Record<string, string>;
  const isApprovable = ["pending", "under_review"].includes(p.status);
  const isPayable = ["approved", "processing"].includes(p.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/admin/payouts" className="text-xs text-subtle-foreground hover:underline">← العودة</Link>
          <h1 className="mt-1 text-2xl font-bold">طلب سحب</h1>
          <p className="text-sm text-subtle-foreground">{p.charity_groups?.name ?? "—"}</p>
        </div>
        <StatusBadge label={sb.label} kind={sb.kind} />
      </div>

      <Card>
        <CardHeader><CardTitle>تفاصيل السحب</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="المبلغ" value={formatDZD(Number(p.amount))} />
          <Row label="العملة" value={p.currency} />
          <Row label="تاريخ الطلب" value={formatDate(p.requested_at)} />
          {p.approved_at ? <Row label="تاريخ الموافقة" value={formatDate(p.approved_at)} /> : null}
          {p.paid_at ? <Row label="تاريخ الدفع" value={formatDate(p.paid_at)} /> : null}
          {p.external_reference ? <Row label="مرجع الدفع" value={p.external_reference} /> : null}
          {p.rejection_reason ? <Row label="سبب الرفض" value={p.rejection_reason} /> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>وجهة السحب</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {Object.entries(dest).map(([k, v]) => (
            <Row key={k} label={k} value={String(v)} />
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {isApprovable ? (
          <>
            <Button onClick={() => approveMut.mutate()} disabled={approveMut.isPending}>
              {approveMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} موافقة
            </Button>
            <Button variant="destructive" onClick={() => setDialog("reject")}>
              <XCircle className="size-4" /> رفض
            </Button>
          </>
        ) : null}
        {isPayable ? (
          <Button onClick={() => setDialog("mark_paid")}>تأكيد الدفع</Button>
        ) : null}
      </div>

      <ConfirmDialog
        open={dialog === "reject"}
        onOpenChange={(v) => setDialog(v ? "reject" : null)}
        title="رفض السحب"
        requireReason
        reasonLabel="سبب الرفض"
        destructive
        confirmLabel="تأكيد الرفض"
        loading={rejectMut.isPending}
        onConfirm={(r) => r ? rejectMut.mutate(r) : null}
      />

      <Dialog open={dialog === "mark_paid"} onOpenChange={(v) => setDialog(v ? "mark_paid" : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأكيد الدفع</DialogTitle>
            <DialogDescription>أدخل مرجع الدفع الخارجي (رقم العملية البنكية، CCP، إلخ).</DialogDescription>
          </DialogHeader>
          <input
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="مثال: TX-2026-001234"
            value={externalRef}
            onChange={(e) => setExternalRef(e.target.value)}
            minLength={3}
            maxLength={80}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>إلغاء</Button>
            <Button
              disabled={externalRef.trim().length < 3 || markPaidMut.isPending}
              onClick={() => markPaidMut.mutate(externalRef.trim())}
            >
              {markPaidMut.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              تأكيد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
