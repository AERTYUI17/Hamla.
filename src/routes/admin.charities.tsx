import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { APP_STATUS_BADGE, StatusBadge } from "@/components/hamla/status-badge";
import { formatDate } from "@/lib/format";
import { listCharityApplications } from "@/lib/server/admin/charities.server";

export const Route = createFileRoute("/admin/charities")({
  head: () => ({ meta: [{ title: "طلبات الجمعيات | حملة" }] }),
  component: AdminCharitiesPage,
});

const FILTERS = [
  { value: "submitted", label: "قيد المراجعة" },
  { value: "under_review", label: "قيد المراجعة" },
  { value: "approved", label: "مقبول" },
  { value: "rejected", label: "مرفوض" },
  { value: "more_info_required", label: "مطلوب معلومات" },
  { value: "suspended", label: "موقوف" },
];

function AdminCharitiesPage() {
  const [status, setStatus] = useState<string | undefined>(undefined);
  const fetch = useServerFn(listCharityApplications);
  const q = useQuery({
    queryKey: ["admin-charity-applications", status ?? "all"],
    queryFn: () => fetch({ data: { status: status ?? null } }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">طلبات الجمعيات</h1>
        <div className="flex flex-wrap gap-2 text-xs">
          <Button
            size="sm"
            variant={status === undefined ? "default" : "outline"}
            onClick={() => setStatus(undefined)}
          >
            الكل
          </Button>
          {FILTERS.map((f) => (
            <Button
              key={f.value}
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
              <th className="px-3 py-2 text-start font-medium">اسم الجمعية</th>
              <th className="px-3 py-2 text-start font-medium">الولاية</th>
              <th className="px-3 py-2 text-start font-medium">تاريخ التقديم</th>
              <th className="px-3 py-2 text-start font-medium">الحالة</th>
              <th className="px-3 py-2 text-end font-medium">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {q.isPending ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-3" colSpan={5}>
                    <Skeleton className="h-5 w-full" />
                  </td>
                </tr>
              ))
            ) : q.isError || !q.data ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-destructive">
                  تعذر تحميل الطلبات.
                </td>
              </tr>
            ) : q.data.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-subtle-foreground">
                  لا توجد طلبات.
                </td>
              </tr>
            ) : (
              q.data.map((row) => {
                const badge = APP_STATUS_BADGE[row.status] ?? { label: row.status, kind: "info" as const };
                return (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-3 py-3 font-medium">{row.org_name_ar}</td>
                    <td className="px-3 py-3">{row.org_wilaya}</td>
                    <td className="px-3 py-3">{formatDate(row.submitted_at)}</td>
                    <td className="px-3 py-3">
                      <StatusBadge label={badge.label} kind={badge.kind} />
                    </td>
                    <td className="px-3 py-3 text-end">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/admin/charities/$id" params={{ id: row.id }}>
                          عرض
                        </Link>
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
