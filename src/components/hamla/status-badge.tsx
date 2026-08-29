import { cn } from "@/lib/utils";

export type StatusKind = "info" | "ok" | "warn" | "err" | "muted";

const TONE: Record<StatusKind, string> = {
  info: "bg-secondary text-foreground/80",
  ok: "bg-primary-soft text-primary-strong",
  warn: "bg-highlight-soft text-highlight",
  err: "bg-destructive/10 text-destructive",
  muted: "bg-muted text-muted-foreground",
};

export function StatusBadge({ label, kind = "info" }: { label: string; kind?: StatusKind }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONE[kind],
      )}
    >
      {label}
    </span>
  );
}

export const APP_STATUS_BADGE: Record<string, { label: string; kind: StatusKind }> = {
  draft: { label: "مسودة", kind: "muted" },
  submitted: { label: "قيد المراجعة", kind: "info" },
  under_review: { label: "قيد المراجعة", kind: "info" },
  approved: { label: "مقبول", kind: "ok" },
  rejected: { label: "مرفوض", kind: "err" },
  more_info_required: { label: "مطلوب معلومات", kind: "warn" },
  suspended: { label: "موقوف", kind: "err" },
};

export const CAMPAIGN_STATUS_BADGE: Record<string, { label: string; kind: StatusKind }> = {
  draft: { label: "مسودة", kind: "muted" },
  submitted: { label: "قيد المراجعة", kind: "info" },
  published: { label: "منشور", kind: "ok" },
  paused: { label: "متوقف", kind: "warn" },
  completed: { label: "مكتمل", kind: "ok" },
  rejected: { label: "مرفوض", kind: "err" },
  suspended: { label: "موقوف", kind: "err" },
  archived: { label: "مؤرشف", kind: "muted" },
};

export const PAYOUT_STATUS_BADGE: Record<string, { label: string; kind: StatusKind }> = {
  pending: { label: "قيد الانتظار", kind: "info" },
  under_review: { label: "قيد المراجعة", kind: "info" },
  approved: { label: "موافق عليه", kind: "ok" },
  processing: { label: "قيد المعالجة", kind: "info" },
  paid: { label: "مدفوع", kind: "ok" },
  rejected: { label: "مرفوض", kind: "err" },
  failed: { label: "فشل", kind: "err" },
};
