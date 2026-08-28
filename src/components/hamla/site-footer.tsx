import { HamlaMark } from "./logo";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border bg-secondary">
      <div className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2">
              <HamlaMark className="h-8" />
              <span className="font-semibold">HAMLA · حملة</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-subtle-foreground">
              منصة جزائرية للتمويل الجماعي تربط أصحاب الحاجة بمن يستطيع المساعدة، بشفافية
              وتوثيق كامل للمصاريف.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3">
            <div className="space-y-2">
              <p className="font-medium">المنصة</p>
              <p className="text-subtle-foreground">كيف تعمل؟</p>
              <p className="text-subtle-foreground">إنشاء حملة</p>
              <p className="text-subtle-foreground">الأسئلة الشائعة</p>
            </div>
            <div className="space-y-2">
              <p className="font-medium">الثقة</p>
              <p className="text-subtle-foreground">توثيق الحملات</p>
              <p className="text-subtle-foreground">حماية التبرعات</p>
              <p className="text-subtle-foreground">الإبلاغ عن حملة</p>
            </div>
            <div className="space-y-2">
              <p className="font-medium">قانوني</p>
              <p className="text-subtle-foreground">شروط الاستخدام</p>
              <p className="text-subtle-foreground">سياسة الخصوصية</p>
            </div>
          </div>
        </div>

        <p className="mt-10 text-xs text-subtle-foreground">
          © {new Date().getFullYear()} حملة — جميع الحقوق محفوظة. العملة: الدينار الجزائري (دج).
        </p>
      </div>
    </footer>
  );
}
