import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { listAdminAuditLog } from "@/lib/server/admin/audit-log.server";

export const Route = createFileRoute("/admin/audit-log")({
  head: () => ({ meta: [{ title: "سجل النشاط | حملة" }] }),
  component: AdminAuditLogPage,
});

function AdminAuditLogPage() {
  const [page, setPage] = useState(0);
  const fetch = useServerFn(listAdminAuditLog);
  const q = useQuery({
    queryKey: ["admin-audit-log", page],
    queryFn: () => fetch({ data: { offset: page * 50 } }),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">سجل النشاط</h1>
      <Card>
        <CardHeader><CardTitle>آخر الإجراءات ({q.data?.length ?? 0} إدخال)</CardTitle></CardHeader>
        <CardContent className="p-0">
          {q.isPending ? (
            <div className="p-4"><Skeleton className="h-40 w-full" /></div>
          ) : q.isError || !q.data ? (
            <p className="p-6 text-sm text-destructive">تعذر التحميل.</p>
          ) : q.data.length === 0 ? (
            <p className="p-6 text-sm text-subtle-foreground">لا يوجد نشاط.</p>
          ) : (
            <ul className="divide-y divide-border">
              {q.data.map((row) => (
                <li key={row.id} className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{row.action}</span>
                    <span className="text-xs text-subtle-foreground">{formatDate(row.created_at)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-subtle-foreground">
                    {row.target_type} · {row.target_id}
                  </p>
                  {row.metadata && Object.keys(row.metadata as object).length > 0 ? (
                    <pre className="mt-1 overflow-x-auto rounded bg-secondary p-2 text-[10px] leading-snug">
                      {JSON.stringify(row.metadata, null, 2)}
                    </pre>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm disabled:opacity-50"
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          السابق
        </button>
        <span className="px-2 py-1.5 text-sm">صفحة {page + 1}</span>
        <button
          type="button"
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm disabled:opacity-50"
          disabled={!q.data || q.data.length < 50}
          onClick={() => setPage((p) => p + 1)}
        >
          التالي
        </button>
      </div>
    </div>
  );
}
