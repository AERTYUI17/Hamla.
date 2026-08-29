import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PAYOUT_STATUS_BADGE, StatusBadge } from "@/components/hamla/status-badge";
import { formatDZD, formatDate } from "@/lib/format";
import { listMyPayouts } from "@/lib/server/charity/payouts.server";

export const Route = createFileRoute("/charity/payouts")({
  head: () => ({ meta: [{ title: "السحوبات | حملة" }] }),
  component: MyPayoutsPage,
});

function MyPayoutsPage() {
  const fetch = useServerFn(listMyPayouts);
  const q = useQuery({
    queryKey: ["my-payouts"],
    queryFn: () => fetch({ data: {} }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">السحوبات</h1>
        <Button asChild>
          <Link to="/charity/payouts/new"><Plus className="size-4" /> طلب سحب جديد</Link>
        </Button>
      </div>

      {q.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : q.isError || !q.data ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-destructive">تعذر التحميل.</div>
      ) : q.data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-subtle-foreground">لم تطلب أي سحب بعد.</p>
          <Button asChild className="mt-4">
            <Link to="/charity/payouts/new">اطلب سحباً</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-xs text-subtle-foreground">
              <tr>
                <th className="px-3 py-2 text-start font-medium">المبلغ</th>
                <th className="px-3 py-2 text-start font-medium">الطريقة</th>
                <th className="px-3 py-2 text-start font-medium">تاريخ الطلب</th>
                <th className="px-3 py-2 text-start font-medium">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((p) => {
                const sb = PAYOUT_STATUS_BADGE[p.status] ?? { label: p.status, kind: "info" as const };
                const dest = (p.destination as any) ?? {};
                return (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-3 py-3 font-mono">{formatDZD(Number(p.amount))}</td>
                    <td className="px-3 py-3">
                      {dest.method === "ccp" ? "CCP" : dest.method === "bank" ? "بنك" : dest.method === "baridimob" ? "بريدي موب" : "—"}
                    </td>
                    <td className="px-3 py-3">{formatDate(p.requested_at)}</td>
                    <td className="px-3 py-3"><StatusBadge label={sb.label} kind={sb.kind} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
