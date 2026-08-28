import { Heart, Share2, TrendingUp, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDZD, progressPercent } from "@/lib/format";

export function DonationCard({
  raised,
  goal,
  donorCount,
  onDonate,
  onShare,
}: {
  raised: number;
  goal: number;
  donorCount: number;
  onDonate: () => void;
  onShare: () => void;
}) {
  const percent = progressPercent(raised, goal);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_2px_18px_-8px_rgba(0,0,0,0.18)]">
      <p className="text-2xl font-bold text-foreground">
        {formatDZD(raised)}{" "}
        <span className="text-sm font-normal text-subtle-foreground">
          تم جمعها من أصل {formatDZD(goal)}
        </span>
      </p>

      <div
        className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-primary-strong transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-subtle-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Users className="size-3.5" />
          {donorCount} متبرع
        </span>
        <span className="inline-flex items-center gap-1.5">
          <TrendingUp className="size-3.5" />
          {Math.round(percent)}% من الهدف
        </span>
      </div>

      <div className="mt-5 space-y-2">
        <Button className="h-11 w-full text-base" onClick={onDonate}>
          <Heart className="size-4" />
          تبرّع الآن
        </Button>
        <Button variant="outline" className="h-11 w-full text-base" onClick={onShare}>
          <Share2 className="size-4" />
          شارك الحملة
        </Button>
      </div>

      <p className="mt-4 text-center text-xs text-subtle-foreground">
        المشاركة مجانية وتضاعف فرص الوصول إلى الهدف.
      </p>
    </div>
  );
}
