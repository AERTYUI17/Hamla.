import { BadgeCheck, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function CharityVerifiedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary-strong",
        className,
      )}
    >
      <BadgeCheck className="size-3.5" />
      جمعية موثقة
    </span>
  );
}

export function CampaignCertifiedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-highlight-soft px-2.5 py-0.5 text-xs font-medium text-highlight",
        className,
      )}
    >
      <ShieldCheck className="size-3.5" />
      حملة موثقة من حملة
    </span>
  );
}
