import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FlaskConical, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { SiteHeader } from "@/components/hamla/site-header";
import { Button } from "@/components/ui/button";
import { recordSandboxOutcome } from "@/lib/donations.functions";

export const Route = createFileRoute("/payment-sandbox")({
  validateSearch: z.object({ reference: z.string().catch("") }),
  head: () => ({
    meta: [
      { title: "بوابة الدفع — وضع الاختبار | حملة" },
      {
        name: "description",
        content: "صفحة اختبار داخلية لمحاكاة نتائج بوابة الدفع دون أي عملية دفع حقيقية.",
      },
      { property: "og:title", content: "بوابة الدفع — وضع الاختبار | حملة" },
      { property: "og:description", content: "محاكاة نتائج بوابة الدفع في وضع الاختبار." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SandboxPage,
});

const OUTCOMES = [
  { value: "PAID", label: "نجاح الدفع", variant: "default" as const },
  { value: "FAILED", label: "فشل الدفع", variant: "outline" as const },
  { value: "CANCELLED", label: "إلغاء العملية", variant: "outline" as const },
];

function SandboxPage() {
  const { reference } = Route.useSearch();
  const navigate = useNavigate();
  const record = useServerFn(recordSandboxOutcome);

  const mutation = useMutation({
    mutationFn: (outcome: "PAID" | "FAILED" | "CANCELLED") =>
      record({ data: { reference, outcome } }),
    onSuccess: () => navigate({ to: "/donation/$reference", params: { reference } }),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-dashed border-primary bg-card p-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary-strong">
            <FlaskConical className="size-3.5" />
            وضع الاختبار — لا يوجد دفع حقيقي
          </span>

          <h1 className="mt-4 text-lg font-semibold">محاكاة بوابة الدفع</h1>
          <p className="mt-2 text-sm leading-relaxed text-subtle-foreground">
            هذه صفحة اختبار داخلية تُستخدم قبل ربط بوابة الدفع الجزائرية. اختر النتيجة التي
            تريد محاكاتها، وسيتم تسجيلها على الخادم ثم التحقق منها كأي عملية حقيقية.
          </p>

          {!reference ? (
            <p className="mt-6 text-sm text-destructive">مرجع العملية مفقود في الرابط.</p>
          ) : (
            <>
              <p className="mt-6 text-xs text-subtle-foreground">مرجع العملية: {reference}</p>
              <div className="mt-4 space-y-2">
                {OUTCOMES.map((outcome) => (
                  <Button
                    key={outcome.value}
                    variant={outcome.variant}
                    className="h-11 w-full"
                    disabled={mutation.isPending}
                    onClick={() =>
                      mutation.mutate(outcome.value as "PAID" | "FAILED" | "CANCELLED")
                    }
                  >
                    {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                    {outcome.label}
                  </Button>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
