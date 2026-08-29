import { Link } from "@tanstack/react-router";
import { Users } from "lucide-react";

import { CampaignCertifiedBadge, CharityVerifiedBadge } from "@/components/hamla/certified-badge";
import { formatDZD, progressPercent } from "@/lib/format";

export interface CampaignCardData {
  id: string;
  slug: string;
  title: string;
  cover_image: string | null;
  goal_amount: number;
  raised_amount: number;
  donor_count: number;
  certified: boolean;
  charityVerified: boolean;
  charityName: string | null;
}

export function CampaignCard({ campaign, href }: { campaign: CampaignCardData; href?: any }) {
  const raised = Number(campaign.raised_amount ?? 0);
  const goal = Number(campaign.goal_amount ?? 0);
  const percent = progressPercent(raised, goal);
  return (
    <Link
      to={href ?? "/c/$slug"}
      params={{ slug: campaign.slug }}
      className="block overflow-hidden rounded-2xl border border-border bg-card transition hover:bg-secondary"
    >
      <div className="aspect-video w-full overflow-hidden bg-secondary">
        {campaign.cover_image ? (
          <img
            src={campaign.cover_image}
            alt={campaign.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-subtle-foreground">
            <span className="text-xs">لا توجد صورة</span>
          </div>
        )}
      </div>
      <div className="space-y-2 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-sm font-semibold">{campaign.title}</h3>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {campaign.certified ? <CampaignCertifiedBadge /> : null}
            {campaign.charityVerified ? <CharityVerifiedBadge /> : null}
          </div>
        </div>
        {campaign.charityName ? (
          <p className="text-xs text-subtle-foreground">بواسطة {campaign.charityName}</p>
        ) : null}
        <div>
          <p className="text-sm font-bold">
            {formatDZD(raised)}{" "}
            <span className="text-xs font-normal text-subtle-foreground">
              من {formatDZD(goal)}
            </span>
          </p>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary-strong"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
        <p className="inline-flex items-center gap-1 text-xs text-subtle-foreground">
          <Users className="size-3.5" /> {campaign.donor_count ?? 0} متبرع
        </p>
      </div>
    </Link>
  );
}
