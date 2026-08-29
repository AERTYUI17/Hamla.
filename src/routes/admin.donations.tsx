import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/hamla/status-badge";
import { formatDZD, formatDate } from "@/lib/format";
import { listAdminDonations } from "@/lib/server/admin/donations.server";

export const Route = createFileRoute("/admin/donations")({
  head: () => ({ meta: [{ title: "التبرعات | حملة" }] }),
  component: AdminDonationsPage,
});

const FILTERS: { value: string | undefined; label: string }[] = [
  { value: undefined, label: "الكل" },
  { value: "PENDING", label: "قيد الانتظار" },
  { value: "PROCESSING", label: "قيد المعالجة" },
  { value: "PAID", label: "مدفوع" },
  { value: "FAILED", label: "فشل" },
  { value: "CANCELLED", label: "ملغى" },
  { value: "REFUNDED", label: "مسترد" },
];

function AdminDonationsPage() {
  const [status, setStatus] = useState<string | undefined>(undefined);
  const fetch = useServerFn(listAdminDonations);
  const q = useQuery({
    queryKey: ["admin-donations", status ?? "all"],
    queryFn: () => fetch({ data: { status: status ?? null } }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">التبرعات</h1>
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
              <th className="px-3 py-2 text-start font-medium">المرجع</th>
              <th className="px-3 py-2 text-start font-medium">المتبرع</th>
              <th className="px-3 py-2 text-start font-medium">الحملة</th>
              <th className="px-3 py-2 text-start font-medium">المبلغ</th>
              <th className="px-3 py-2 text-start font-medium">الحالة</th>
              <th className="px-3 py-2 text-start font-medium">التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {q.isPending ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-3" colSpan={6}><Skeleton className="h-5 w-full" /></td>
                </tr>
              ))
            ) : q.isError || !q.data ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-destructive">تعذر التحميل.</td></tr>
            ) : q.data.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-subtle-foreground">لا توجد تبرعات.</td></tr>
            ) : (
              q.data.map((d) => (
                <tr key={d.id} className="border-t border-border">
                  <td className="px-3 py-3 font-mono text-xs">
                    <Link to="/admin/donations/$id" params={{ id: d.id }} className="hover:underline">
                      {d.reference}
                    </Link>
                  </td>
                  <td className="px-3 py-3">{d.anonymous ? "مجهول" : (d.donor_name ?? "—")}</td>
                  <td className="px-3 py-3">{(d as any).campaigns?.title ?? "—"}</td>
                  <td className="px-3 py-3">{formatDZD(Number(d.amount))}</td>
                  <td className="px-3 py-3"><StatusBadge label={d.status} kind={d.status === "PAID" ? "ok" : d.status === "FAILED" ? "err" : "info"} /></td>
                  <td className="px-3 py-3">{formatDate(d.paid_at ?? d.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
