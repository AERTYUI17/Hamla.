const nf = new Intl.NumberFormat("ar-DZ", { maximumFractionDigits: 0 });

export function formatAmount(value: number | string): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "0";
  return nf.format(Math.round(n));
}

export function formatDZD(value: number | string): string {
  return `${formatAmount(value)} دج`;
}

export function progressPercent(raised: number, goal: number): number {
  if (!goal || goal <= 0) return 0;
  return Math.min(100, Math.max(0, (raised / goal) * 100));
}

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - then);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "الآن";
  if (min < 60) return `منذ ${min} دقيقة`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return hours === 1 ? "منذ ساعة" : hours === 2 ? "منذ ساعتين" : `منذ ${hours} ساعات`;
  const days = Math.floor(hours / 24);
  if (days < 30) return days === 1 ? "منذ يوم" : days === 2 ? "منذ يومين" : `منذ ${days} أيام`;
  const months = Math.floor(days / 30);
  return months === 1 ? "منذ شهر" : `منذ ${months} أشهر`;
}

const dateFmt = new Intl.DateTimeFormat("ar-DZ", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("ar-DZ", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}

export function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso));
}

export function formatDateNumeric(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "في الانتظار",
  PROCESSING: "قيد المعالجة",
  PAID: "مدفوع",
  FAILED: "فشل الدفع",
  CANCELLED: "ملغى",
  REFUNDED: "مُسترجع",
};
