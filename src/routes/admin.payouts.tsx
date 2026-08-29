import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PAYOUT_STATUS_BADGE, StatusBadge } from "@/components/hamla/status-badge";
import { formatDZD, formatDate } from "@/lib/format";
import { listAdminPayouts } from "@/lib/server/admin/payouts.server";

export const Route = createFileRoute("/admin/payouts")({
  head: () => ({ meta: [{ title: "السحوبات | حملة" }] }),
  component: AdminPayoutsPage,
});

const FILTERS: { value: string | undefined; label: string }[] = [
  { value: undefined, label: "الكل" },
  { value: "pending", label: "قيد الانتظار" },
  { value: "under_review", label: "قيد المراجعة" },
  { value: "approved", label: "موافق عليها" },
  { value: "processing", label: "قيد المعالجة" },
  { value: "paid", label: "مدفوعة" },
  { value: "rejected", label: "مرفوضة" },
  { value: "failed", label: "فشلت" },
];

function AdminPayoutsPage() {
  const [status, setStatus] = useState<string | undefined>(undefined);
  const fetch = useServerFn(listAdminPayouts);
  const q = useQuery({
    queryKey: ["admin-payouts", status ?? "all"],
    queryFn: () => fetch({ data: { status: status ?? null } }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">السحوبات</h1>
        <div className="flex flex-wrap gap-2 text-xs">
          {FILTERS.map((f) => (
            <Button
              key={f.label}
              size="sm"
              variant={status === f.value ? "default" : "outline"}
              onClick={() => setStatus(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs text-subtle-foreground">
            <tr>
              <th className="px-3 py-2 text-start font-medium">الجمعية</th>
              <th className="px-3 py-2 text-start font-medium">المبلغ</th>
              <th className="px-3 py-2 text-start font-medium">تاريخ الطلب</th>
              <th className="px-3 py-2 text-start font-medium">الحالة</th>
              <th className="px-3 py-2 text-end font-medium">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {q.isPending ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-3" colSpan={5}><Skeleton className="h-5 w-full" /></td>
                </tr>
              ))
            ) : q.isError || !q.data ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-destructive">تعذر التحميل.</td></tr>
            ) : q.data.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-subtle-foreground">لا توجد سحوبات.</td></tr>
            ) : (
              q.data.map((p) => {
                const sb = PAYOUT_STATUS_BADGE[p.status] ?? { label: p.status, kind: "info" as const };
                return (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-3 py-3 font-medium">{(p as any).charity_groups?.name ?? "—"}</td>
                    <td className="px-3 py-3">{formatDZD(Number(p.amount))}</td>
                    <td className="px-3 py-3">{formatDate(p.requested_at)}</td>
                    <td className="px-3 py-3"><StatusBadge label={sb.label} kind={sb.kind} /></td>
                    <td className="px-3 py-3 text-end">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/admin/payouts/$id" params={{ id: p.id }}>عرض</Link>
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
