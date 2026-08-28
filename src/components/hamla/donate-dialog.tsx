import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth, displayNameOf } from "@/hooks/use-auth";
import { startDonation } from "@/lib/donations.functions";
import { formatDZD } from "@/lib/format";

const PRESETS = [1000, 2500, 5000, 10000, 25000];

export function DonateDialog({
  open,
  onOpenChange,
  slug,
  campaignTitle,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  slug: string;
  campaignTitle: string;
}) {
  const { user, loading } = useAuth();
  const start = useServerFn(startDonation);

  const [amount, setAmount] = useState<number | "">(2500);
  const [anonymous, setAnonymous] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const signIn = async () => {
    const { lovable } = await import("@/integrations/lovable/index");
    await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
  };

  const submit = async () => {
    const value = typeof amount === "number" ? amount : Number(amount);
    if (!Number.isFinite(value) || value < 100) {
      toast.error("أقل مبلغ للتبرع هو 100 دج.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await start({
        data: {
          slug,
          amount: Math.round(value),
          anonymous,
          ...(message.trim() ? { message: message.trim() } : {}),
          ...(user && !anonymous ? { displayName: displayNameOf(user) } : {}),
          origin: window.location.origin,
        },
      });
      window.location.href = result.redirectUrl;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر بدء عملية الدفع.");
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-lg">
        <DialogHeader className="text-start">
          <DialogTitle>تبرّع لحملة</DialogTitle>
          <DialogDescription className="line-clamp-2">{campaignTitle}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-6 animate-spin text-subtle-foreground" />
          </div>
        ) : !user ? (
          <div className="space-y-4 py-2">
            <p className="text-sm text-subtle-foreground">
              سجّل الدخول أولاً حتى نتمكن من إصدار إيصال رسمي باسمك وحفظ سجل تبرعاتك.
            </p>
            <Button className="w-full" onClick={() => void signIn()}>
              متابعة عبر حساب Google
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>اختر المبلغ</Label>
              <div className="grid grid-cols-3 gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setAmount(p)}
                    className={`rounded-lg border px-2 py-2.5 text-sm transition-colors ${
                      amount === p
                        ? "border-primary-strong bg-primary-soft font-semibold text-primary-strong"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    {formatDZD(p)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="custom-amount">أو أدخل مبلغاً آخر (دج)</Label>
              <Input
                id="custom-amount"
                inputMode="numeric"
                value={amount === "" ? "" : String(amount)}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^\d]/g, "");
                  setAmount(v === "" ? "" : Number(v));
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="donation-message">كلمة تشجيع (اختياري)</Label>
              <Textarea
                id="donation-message"
                maxLength={300}
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="اكتب رسالة قصيرة للعائلة…"
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={anonymous}
                onCheckedChange={(v) => setAnonymous(v === true)}
                id="anonymous"
              />
              <span>أريد أن يكون تبرعي مجهولاً</span>
            </label>

            <p className="flex items-start gap-2 rounded-lg bg-primary-soft p-3 text-xs text-primary-strong">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" />
              يتم الدفع عبر بوابة الدفع الرسمية، ولا تمر بيانات بطاقتك عبر منصة حملة إطلاقاً.
            </p>

            <DialogFooter>
              <Button className="w-full" disabled={submitting} onClick={() => void submit()}>
                {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                متابعة إلى الدفع
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
