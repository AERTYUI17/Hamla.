import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({ meta: [{ title: "الإعدادات | حملة" }] }),
  component: AdminSettingsPage,
});

function AdminSettingsPage() {
  const provider = (import.meta as any).env?.VITE_PAYMENT_PROVIDER ?? process.env["PAYMENT_PROVIDER"] ?? "algerian-gateway";
  const isSlickPay = (provider ?? "").toString().toLowerCase() === "slickpay";
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">الإعدادات</h1>

      <Card>
        <CardHeader><CardTitle>بوابة الدفع</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>المزوّد النشط: <span className="font-mono">{provider}</span></p>
          {isSlickPay ? (
            <div className="rounded-lg border border-highlight bg-highlight-soft p-4 text-highlight-foreground">
              <p className="font-semibold">SlickPay غير مهيأ بعد</p>
              <p className="mt-1 text-xs leading-relaxed">
                تم اختيار SlickPay كبوابة دفع، لكن التوثيق الرسمي للـ API لم يصل بعد. المنصة تستخدم حالياً البوابة الافتراضية أو وضع الاختبار. أرسل وثائق API إلى فريق حملة لتفعيل SlickPay.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-primary bg-primary-soft p-4 text-primary-strong">
              <p>البوابة النشطة هي البوابة الجزائرية الافتراضية (وضع الإنتاج أو الاختبار حسب الإعدادات).</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>الإعدادات العامة</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-subtle-foreground">
          <p>ستضاف هنا إعدادات إضافية (الحد الأدنى والأقصى للتبرع، رسوم المنصة، إعدادات البريد) في إصدارات لاحقة.</p>
        </CardContent>
      </Card>
    </div>
  );
}
