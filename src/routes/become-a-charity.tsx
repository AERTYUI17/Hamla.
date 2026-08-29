import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, ChevronLeft, Loader2 } from "lucide-react";

import { SiteFooter } from "@/components/hamla/site-footer";
import { SiteHeader } from "@/components/hamla/site-header";
import { FileUploader, type UploadedFile } from "@/components/hamla/file-uploader";
import { WilayaSelect } from "@/components/hamla/wilaya-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import {
  ALLOWED_DOCUMENT_MIME,
  CHARITY_DOCUMENTS_BUCKET,
  MAX_DOCUMENT_BYTES,
} from "@/lib/storage-paths";
import { supabase } from "@/integrations/supabase/client";
import { submitCharityApplication } from "@/lib/charity-applications.server";

export const Route = createFileRoute("/become-a-charity")({
  head: () => ({
    meta: [
      { title: "طلب صفة جمعية خيرية | حملة" },
      { name: "description", content: "قدّم طلبك للحصول على صفة جمعية خيرية على منصة حملة." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BecomeACharityPage,
});

const formSchema = z.object({
  orgName: z.string().min(3, "الاسم قصير جداً"),
  orgNameAr: z.string().min(3, "الاسم بالعربية قصير جداً"),
  orgDescription: z.string().min(50, "الوصف يجب أن يكون 50 حرفاً على الأقل").max(1000),
  orgCategory: z.enum(["education", "health", "family", "emergency", "orphan", "mosque", "other"]),
  orgWilaya: z.string().min(1, "اختر الولاية"),
  orgCommune: z.string().min(2, "أدخل البلدية"),
  orgAddress: z.string().min(5, "أدخل العنوان"),
  orgPhone: z.string().regex(/^(0)(5|6|7)[0-9]{8}$/, "رقم الهاتف غير صالح"),
  orgEmail: z.string().email("بريد إلكتروني غير صالح"),
  orgWebsite: z.string().url("رابط غير صالح").or(z.literal("")).optional(),
  repName: z.string().min(2, "أدخل اسم الممثل"),
  repPhone: z.string().regex(/^(0)(5|6|7)[0-9]{8}$/, "رقم الهاتف غير صالح"),
  repEmail: z.string().email("بريد إلكتروني غير صالح"),
  registrationNumber: z.string().min(3, "أدخل رقم التسجيل"),
  registrationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صالح"),
});

type FormValues = z.infer<typeof formSchema>;

const categoryLabels: Record<FormValues["orgCategory"], string> = {
  education: "تعليم",
  health: "صحة",
  family: "أسر وعائلات",
  emergency: "طوارئ",
  orphan: "أيتام",
  mosque: "مساجد ودور عبادة",
  other: "أخرى",
};

function BecomeACharityPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const submit = useServerFn(submitCharityApplication);
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<UploadedFile[]>([]);

  const { register, handleSubmit, formState, setValue, watch } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      orgName: "",
      orgNameAr: "",
      orgDescription: "",
      orgCategory: "other",
      orgWilaya: "",
      orgCommune: "",
      orgAddress: "",
      orgPhone: "",
      orgEmail: "",
      orgWebsite: "",
      repName: "",
      repPhone: "",
      repEmail: "",
      registrationNumber: "",
      registrationDate: "",
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!user) throw new Error("يجب تسجيل الدخول.");
      if (files.length === 0) throw new Error("يرجى رفع وثيقة واحدة على الأقل.");

      const uploadedPaths: {
        storagePath: string;
        mimeType: string;
        sizeBytes: number;
        originalFilename: string;
        type: string;
      }[] = [];
      for (const uf of files) {
        const path = `applications/${user.id}/draft/${crypto.randomUUID()}`;
        const { error: uploadError } = await supabase.storage
          .from(CHARITY_DOCUMENTS_BUCKET)
          .upload(path, uf.file, {
            contentType: uf.file.type,
            upsert: false,
          });
        if (uploadError) {
          throw new Error(`تعذر رفع الملف "${uf.file.name}": ${uploadError.message}`);
        }
        uploadedPaths.push({
          storagePath: path,
          mimeType: uf.file.type,
          sizeBytes: uf.file.size,
          originalFilename: uf.file.name,
          type: "registration_certificate",
        });
      }

      return submit({
        data: {
          orgName: values.orgName,
          orgNameAr: values.orgNameAr,
          orgDescription: values.orgDescription,
          orgCategory: values.orgCategory,
          orgWilaya: values.orgWilaya,
          orgCommune: values.orgCommune,
          orgAddress: values.orgAddress,
          orgPhone: values.orgPhone,
          orgEmail: values.orgEmail,
          orgWebsite: values.orgWebsite || null,
          repName: values.repName,
          repPhone: values.repPhone,
          repEmail: values.repEmail,
          registrationNumber: values.registrationNumber,
          registrationDate: values.registrationDate,
          documents: uploadedPaths,
        },
      });
    },
    onSuccess: () => {
      toast.success("تم استلام طلبك. سيتم مراجعته من قبل فريق حملة.");
      queryClient.invalidateQueries({ queryKey: ["my-charity-application"] });
      void navigate({ to: "/my-charity-application" });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  if (loading) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-4 py-16">
          <Loader2 className="mx-auto size-8 animate-spin text-primary" />
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-xl font-semibold">سجّل الدخول للمتابعة</h1>
          <p className="mt-2 text-sm text-subtle-foreground">
            يجب أن يكون لديك حساب على حملة لتقديم طلب الحصول على صفة جمعية.
          </p>
          <Button asChild className="mt-6">
            <Link to="/">العودة إلى الرئيسية</Link>
          </Button>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (submitMutation.isSuccess) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-xl px-4 py-16">
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <CheckCircle2 className="mx-auto size-12 text-primary-strong" />
            <h1 className="mt-4 text-xl font-bold">تم استلام طلبك</h1>
            <p className="mt-2 text-sm text-subtle-foreground">
              طلبك قيد المراجعة. سنخطرك فور اتخاذ القرار.
            </p>
            <Button asChild className="mt-6">
              <Link to="/my-charity-application">عرض حالة الطلب</Link>
            </Button>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-subtle-foreground hover:text-foreground">
          <ChevronLeft className="size-4" />
          العودة
        </Link>

        <h1 className="mt-4 text-2xl font-bold">طلب صفة جمعية خيرية</h1>
        <p className="mt-2 text-sm text-subtle-foreground">
          املأ المعلومات التالية وأرفق الوثائق الرسمية لجمعيتك. سيتم مراجعة طلبك من قبل فريق حملة.
        </p>

        <form onSubmit={handleSubmit((v) => submitMutation.mutate(v))} className="mt-8 space-y-8">
          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold">معلومات الجمعية</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="orgName">اسم الجمعية (بالفرنسية أو الإنجليزية)</Label>
                <Input id="orgName" {...register("orgName")} />
                {formState.errors.orgName ? <p className="mt-1 text-xs text-destructive">{formState.errors.orgName.message}</p> : null}
              </div>
              <div>
                <Label htmlFor="orgNameAr">اسم الجمعية (بالعربية)</Label>
                <Input id="orgNameAr" {...register("orgNameAr")} />
                {formState.errors.orgNameAr ? <p className="mt-1 text-xs text-destructive">{formState.errors.orgNameAr.message}</p> : null}
              </div>
            </div>
            <div>
              <Label htmlFor="orgDescription">وصف الجمعية</Label>
              <Textarea id="orgDescription" rows={4} {...register("orgDescription")} />
              {formState.errors.orgDescription ? <p className="mt-1 text-xs text-destructive">{formState.errors.orgDescription.message}</p> : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="orgCategory">الفئة</Label>
                <select
                  id="orgCategory"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register("orgCategory")}
                >
                  {Object.entries(categoryLabels).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="orgWilaya">الولاية</Label>
                <WilayaSelect
                  id="orgWilaya"
                  value={watch("orgWilaya")}
                  onChange={(v) => setValue("orgWilaya", v, { shouldValidate: true })}
                />
                {formState.errors.orgWilaya ? <p className="mt-1 text-xs text-destructive">{formState.errors.orgWilaya.message}</p> : null}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="orgCommune">البلدية</Label>
                <Input id="orgCommune" {...register("orgCommune")} />
                {formState.errors.orgCommune ? <p className="mt-1 text-xs text-destructive">{formState.errors.orgCommune.message}</p> : null}
              </div>
              <div>
                <Label htmlFor="orgAddress">العنوان</Label>
                <Input id="orgAddress" {...register("orgAddress")} />
                {formState.errors.orgAddress ? <p className="mt-1 text-xs text-destructive">{formState.errors.orgAddress.message}</p> : null}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="orgPhone">هاتف الجمعية</Label>
                <Input id="orgPhone" inputMode="tel" {...register("orgPhone")} />
                {formState.errors.orgPhone ? <p className="mt-1 text-xs text-destructive">{formState.errors.orgPhone.message}</p> : null}
              </div>
              <div>
                <Label htmlFor="orgEmail">البريد الإلكتروني الرسمي</Label>
                <Input id="orgEmail" type="email" {...register("orgEmail")} />
                {formState.errors.orgEmail ? <p className="mt-1 text-xs text-destructive">{formState.errors.orgEmail.message}</p> : null}
              </div>
            </div>
            <div>
              <Label htmlFor="orgWebsite">الموقع الإلكتروني أو صفحات التواصل (اختياري)</Label>
              <Input id="orgWebsite" type="url" {...register("orgWebsite")} />
              {formState.errors.orgWebsite ? <p className="mt-1 text-xs text-destructive">{formState.errors.orgWebsite.message}</p> : null}
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold">ممثل الجمعية</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="repName">الاسم الكامل</Label>
                <Input id="repName" {...register("repName")} />
                {formState.errors.repName ? <p className="mt-1 text-xs text-destructive">{formState.errors.repName.message}</p> : null}
              </div>
              <div>
                <Label htmlFor="repPhone">الهاتف</Label>
                <Input id="repPhone" inputMode="tel" {...register("repPhone")} />
                {formState.errors.repPhone ? <p className="mt-1 text-xs text-destructive">{formState.errors.repPhone.message}</p> : null}
              </div>
            </div>
            <div>
              <Label htmlFor="repEmail">البريد الإلكتروني</Label>
              <Input id="repEmail" type="email" {...register("repEmail")} />
              {formState.errors.repEmail ? <p className="mt-1 text-xs text-destructive">{formState.errors.repEmail.message}</p> : null}
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold">المعلومات القانونية</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="registrationNumber">رقم التسجيل الرسمي</Label>
                <Input id="registrationNumber" {...register("registrationNumber")} />
                {formState.errors.registrationNumber ? <p className="mt-1 text-xs text-destructive">{formState.errors.registrationNumber.message}</p> : null}
              </div>
              <div>
                <Label htmlFor="registrationDate">تاريخ التسجيل</Label>
                <Input id="registrationDate" type="date" {...register("registrationDate")} />
                {formState.errors.registrationDate ? <p className="mt-1 text-xs text-destructive">{formState.errors.registrationDate.message}</p> : null}
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold">الوثائق الرسمية</legend>
            <p className="text-sm text-subtle-foreground">
              شهادة التسجيل، الاعتماد الرسمي، أو أي وثائق أخرى تثبت هوية الجمعية. PDF أو صور (JPG, PNG) حتى 10 ميغابايت لكل ملف.
            </p>
            <FileUploader
              accept={Array.from(ALLOWED_DOCUMENT_MIME).join(",")}
              maxBytes={MAX_DOCUMENT_BYTES}
              maxFiles={10}
              value={files}
              onChange={setFiles}
            />
          </fieldset>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" asChild>
              <Link to="/">إلغاء</Link>
            </Button>
            <Button type="submit" disabled={submitMutation.isPending}>
              {submitMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              إرسال الطلب
            </Button>
          </div>
        </form>
      </main>
      <SiteFooter />
    </div>
  );
}
