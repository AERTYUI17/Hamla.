import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/hamla/status-badge";
import { formatDZD, formatDate } from "@/lib/format";
import { getAdminDonation } from "@/lib/server/admin/donations.server";

export const Route = createFileRoute("/admin/donations/$id")({
  head: () => ({ meta: [{ title: "تفاصيل تبرع | حملة" }] }),
  component: AdminDonationDetailPage,
});

function AdminDonationDetailPage() {
  const { id } = Route.useParams();
  const fetch = useServerFn(getAdminDonation);
  const q = useQuery({
    queryKey: ["admin-donation", id],
    queryFn: () => fetch({ data: { id } }),
  });

  if (q.isPending) return <Skeleton className="h-64 w-full" />;
  if (q.isError || !q.data) return <div className="rounded-2xl border border-border bg-card p-6 text-sm text-destructive">تعذر التحميل.</div>;

  const d: any = q.data.donation;
  const p: any = q.data.payment;
  const l: any = q.data.ledger;
  const inv: any = d.invoices;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/donations" className="text-xs text-subtle-foreground hover:underline">← العودة</Link>
        <h1 className="mt-1 text-2xl font-bold">تفاصيل تبرع</h1>
        <p className="font-mono text-sm text-subtle-foreground">{d.reference}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>المعلومات</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="الحملة" value={d.campaigns?.title ?? "—"} />
            <Row label="المبلغ" value={formatDZD(Number(d.amount))} />
            <Row label="الحالة" value={d.status} />
            <Row label="المتبرع" value={d.anonymous ? "مجهول" : (d.donor_name ?? "—")} />
            {d.donor_email ? <Row label="البريد" value={d.donor_email} /> : null}
            <Row label="تاريخ الإنشاء" value={formatDate(d.created_at)} />
            {d.paid_at ? <Row label="تاريخ الدفع" value={formatDate(d.paid_at)} /> : null}
            {d.message ? <Row label="رسالة" value={d.message} /> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>الدفع</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {p ? (
              <>
                <Row label="البوابة" value={p.provider} />
                <Row label="مرجع البوابة" value={p.provider_transaction_id ?? "—"} />
                <Row label="حالة الدفع" value={p.status} />
              </>
            ) : <p className="text-subtle-foreground">لا توجد معلومات دفع.</p>}
            {inv ? (
              <>
                <Row label="رقم الإيصال" value={inv.invoice_number} />
                <Row label="تاريخ الإصدار" value={formatDate(inv.issued_at)} />
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {l ? (
        <Card>
          <CardHeader><CardTitle>القيد المحاسبي</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="النوع" value={l.type} />
            <Row label="المبلغ" value={`${Number(l.amount)} ${l.currency}`} />
            <Row label="الحالة" value={l.status} />
            <Row label="المرجع" value={l.reference ?? "—"} />
            <Row label="تاريخ القيد" value={formatDate(l.created_at)} />
          </CardContent>
        </Card>
      ) : null}
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
