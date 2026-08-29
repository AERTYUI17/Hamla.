import { BadgeCheck, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatDZD, progressPercent } from "@/lib/format";

export interface CampaignPreviewData {
  title: string;
  description: string;
  story: string;
  beneficiary: string;
  category: string;
  wilaya: string;
  location: string;
  goalAmount: number;
  coverImage: string | null;
}

export function CampaignPreview({ data }: { data: CampaignPreviewData }) {
  const percent = progressPercent(0, data.goalAmount);
  return (
    <article className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {data.category ? <Badge variant="secondary">{data.category}</Badge> : null}
        {data.wilaya ? (
          <span className="inline-flex items-center gap-1 text-subtle-foreground">
            <MapPin className="size-3.5" /> {data.wilaya}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1 text-subtle-foreground">
          <BadgeCheck className="size-3.5 text-primary-strong" /> معاينة فقط
        </span>
      </div>
      <h1 className="text-2xl font-bold">{data.title || "(بدون عنوان)"}</h1>
      <p className="text-sm leading-loose text-foreground/85">{data.description}</p>
      <div className="rounded-xl bg-secondary p-4 text-sm">
        <p>
          <span className="text-subtle-foreground">المستفيد: </span>
          <span className="font-medium">{data.beneficiary || "—"}</span>
        </p>
        <p className="mt-1">
          <span className="text-subtle-foreground">الموقع: </span>
          <span className="font-medium">{data.location || "—"}</span>
        </p>
      </div>
      <div>
        <p className="text-2xl font-bold">
          {formatDZD(0)}{" "}
          <span className="text-sm font-normal text-subtle-foreground">
            تم جمعها من أصل {formatDZD(data.goalAmount)}
          </span>
        </p>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary-strong" style={{ width: `${percent}%` }} />
        </div>
      </div>
      <div className="prose story-prose max-w-none whitespace-pre-wrap text-sm leading-loose">
        {data.story || "(لم تُكتب القصة بعد)"}
      </div>
    </article>
  );
}
