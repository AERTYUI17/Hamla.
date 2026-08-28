import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Gift, Trophy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCampaignDonations } from "@/lib/campaign.functions";
import { formatDZD, timeAgo } from "@/lib/format";

type Row = {
  id: string;
  donor_name: string | null;
  amount: number;
  message: string | null;
  created_at: string;
};

function Rows({ rows, showTime }: { rows: Row[]; showTime: boolean }) {
  return (
    <ul className="space-y-4">
      {rows.map((row) => (
        <li key={row.id} className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft">
            <Gift className="size-4 text-primary-strong" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm">
              <span className="font-medium">{row.donor_name ?? "متبرع مجهول"}</span>
              <span className="text-subtle-foreground"> · {formatDZD(row.amount)}</span>
            </p>
            {showTime ? (
              <p className="text-xs text-subtle-foreground">{timeAgo(row.created_at)}</p>
            ) : null}
            {row.message ? (
              <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-foreground/80">
                {row.message}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DonorLists({ slug, donorCount }: { slug: string; donorCount: number }) {
  const fetchDonations = useServerFn(getCampaignDonations);
  const [expanded, setExpanded] = useState(false);
  const limit = expanded ? 50 : 5;

  const recent = useQuery({
    queryKey: ["donations", slug, "recent", limit],
    queryFn: () => fetchDonations({ data: { slug, order: "recent", limit } }),
  });
  const top = useQuery({
    queryKey: ["donations", slug, "top"],
    queryFn: () => fetchDonations({ data: { slug, order: "top", limit: 3 } }),
  });

  const recentRows = (recent.data ?? []) as Row[];
  const topRows = (top.data ?? []) as Row[];

  return (
    <div className="space-y-6 rounded-2xl border border-border bg-card p-5">
      <div>
        <h2 className="text-sm font-semibold">
          {donorCount > 0 ? `${donorCount} شخصاً تبرعوا لهذه الحملة` : "كن أول المتبرعين"}
        </h2>
        <div className="mt-4">
          {recent.isPending ? (
            <ListSkeleton />
          ) : recent.isError ? (
            <p className="text-sm text-destructive">تعذر تحميل قائمة التبرعات.</p>
          ) : recentRows.length === 0 ? (
            <p className="text-sm text-subtle-foreground">
              لا توجد تبرعات بعد — تبرعك سيكون الأول ويشجّع غيرك على المساهمة.
            </p>
          ) : (
            <Rows rows={recentRows} showTime />
          )}
        </div>
      </div>

      {topRows.length > 0 ? (
        <div className="border-t border-border pt-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Trophy className="size-4 text-primary-strong" />
            أعلى التبرعات
          </h2>
          <div className="mt-4">
            <Rows rows={topRows} showTime={false} />
          </div>
        </div>
      ) : null}

      {recentRows.length >= 5 ? (
        <Button variant="outline" className="w-full" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "عرض أقل" : "عرض جميع التبرعات"}
        </Button>
      ) : null}
    </div>
  );
}
