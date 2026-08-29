import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Image as ImageIcon, Loader2, Upload } from "lucide-react";

import { SiteFooter } from "@/components/hamla/site-footer";
import { SiteHeader } from "@/components/hamla/site-header";
import { CampaignPreview } from "@/components/hamla/campaign-preview";
import { WilayaSelect } from "@/components/hamla/wilaya-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ALLOWED_IMAGE_MIME,
  CAMPAIGN_IMAGES_BUCKET,
  MAX_IMAGE_BYTES,
} from "@/lib/storage-paths";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { createMyCampaign, attachCoverImage } from "@/lib/server/charity/campaigns.server";

export const Route = createFileRoute("/charity/campaigns/new")({
  head: () => ({ meta: [{ title: "إنشاء حملة | حملة" }] }),
  component: NewCampaignPage,
});

const formSchema = z.object({
  title: z.string().min(5, "العنوان قصير جداً").max(120),
  slug: z.string().min(3, "الـ slug قصير جداً").max(120).regex(/^[a-z0-9-]+$/, "الـ slug يجب أن يكون بالإنجليزية الصغيرة والأرقام والشرطات فقط"),
  description: z.string().min(50, "الوصف يجب أن يكون 50 حرفاً على الأقل").max(280),
  story: z.string().min(200, "القصة يجب أن تكون 200 حرف على الأقل").max(8000),
  beneficiary: z.string().min(2, "أدخل المستفيد").max(120),
  category: z.enum(["education", "health", "family", "emergency", "orphan", "mosque", "other"]),
  wilaya: z.string().min(1, "اختر الولاية"),
  location: z.string().min(2, "أدخل الموقع").max(120),
  goalAmount: z.coerce.number().int().min(10000, "الحد الأدنى 10,000 دج").max(50_000_000),
  coverImagePath: z.string().nullable().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const categoryLabels: Record<FormValues["category"], string> = {
  education: "تعليم",
  health: "صحة",
  family: "أسر وعائلات",
  emergency: "طوارئ",
  orphan: "أيتام",
  mosque: "مساجد ودور عبادة",
  other: "أخرى",
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function NewCampaignPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const create = useServerFn(createMyCampaign);
  const attach = useServerFn(attachCoverImage);

  const [step, setStep] = useState(1);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const { register, handleSubmit, formState, setValue, watch, getValues } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      slug: "",
      description: "",
      story: "",
      beneficiary: "",
      category: "other",
      wilaya: "",
      location: "",
      goalAmount: 100000,
      coverImagePath: null,
    },
  });

  const submitMut = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!user) throw new Error("يجب تسجيل الدخول.");
      const { id, slug } = await create({ data: values });
      if (values.coverImagePath) {
        await attach({
          data: {
            campaignId: id,
            storagePath: values.coverImagePath,
            mimeType: coverFile?.type ?? "image/jpeg",
            sizeBytes: coverFile?.size ?? 1,
          },
        });
      }
      return { id, slug };
    },
    onSuccess: (res) => {
      toast.success("تم إنشاء الحملة. ستدخل في المراجعة.");
      void navigate({ to: "/charity/campaigns/$id", params: { id: res.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onTitleBlur() {
    const v = getValues();
    if (!v.slug && v.title) setValue("slug", slugify(v.title));
  }

  async function onCoverChange(file: File) {
    setCoverFile(file);
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverPreview(URL.createObjectURL(file));
    if (!user) return;
    const path = `campaigns/__draft__/${user.id}/${crypto.randomUUID()}`;
    const { error } = await supabase.storage
      .from(CAMPAIGN_IMAGES_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      toast.error(`تعذر رفع الصورة: ${error.message}`);
      return;
    }
    setValue("coverImagePath", path, { shouldValidate: true });
  }

  const canAdvance = (s: number): boolean => {
    const v = getValues();
    if (s === 1) return Boolean(v.title && v.slug && v.description && v.beneficiary && v.category && v.wilaya && v.location);
    if (s === 2) return v.story.length >= 200;
    if (s === 3) return v.goalAmount >= 10000;
    return true;
  };

  return (
    <div className="min-h-screen bg-secondary">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold">إنشاء حملة جديدة</h1>
        <p className="mt-1 text-sm text-subtle-foreground">
          أكمل الخطوات الأربع. حملتك ستدخل في المراجعة قبل النشر.
        </p>

        <ol className="mt-6 flex flex-wrap gap-2 text-xs">
          {[1, 2, 3, 4].map((n) => (
            <li
              key={n}
              className={`rounded-full px-3 py-1 ${step === n ? "bg-primary text-primary-foreground" : "bg-card text-subtle-foreground"}`}
            >
              {n}. {["معلومات الحملة", "القصة", "المعلومات المالية", "المراجعة"][n - 1]}
            </li>
          ))}
        </ol>

        <Card className="mt-6">
          <CardContent className="p-6">
            {step === 1 ? (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">معلومات الحملة</h2>
                <div>
                  <Label htmlFor="title">العنوان</Label>
                  <Input id="title" {...register("title", { onBlur: onTitleBlur })} />
                  {formState.errors.title ? <p className="mt-1 text-xs text-destructive">{formState.errors.title.message}</p> : null}
                </div>
                <div>
                  <Label htmlFor="slug">الـ slug (يظهر في الرابط)</Label>
                  <Input id="slug" {...register("slug")} />
                  {formState.errors.slug ? <p className="mt-1 text-xs text-destructive">{formState.errors.slug.message}</p> : null}
                </div>
                <div>
                  <Label htmlFor="description">الوصف المختصر (يظهر في بطاقة الحملة)</Label>
                  <Textarea id="description" rows={3} {...register("description")} />
                  {formState.errors.description ? <p className="mt-1 text-xs text-destructive">{formState.errors.description.message}</p> : null}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="category">الفئة</Label>
                    <select
                      id="category"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      {...register("category")}
                    >
                      {Object.entries(categoryLabels).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="wilaya">الولاية</Label>
                    <WilayaSelect
                      id="wilaya"
                      value={watch("wilaya")}
                      onChange={(v) => setValue("wilaya", v, { shouldValidate: true })}
                    />
                    {formState.errors.wilaya ? <p className="mt-1 text-xs text-destructive">{formState.errors.wilaya.message}</p> : null}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="location">الموقع (البلدية أو المدينة)</Label>
                    <Input id="location" {...register("location")} />
                    {formState.errors.location ? <p className="mt-1 text-xs text-destructive">{formState.errors.location.message}</p> : null}
                  </div>
                  <div>
                    <Label htmlFor="beneficiary">المستفيد</Label>
                    <Input id="beneficiary" {...register("beneficiary")} />
                    {formState.errors.beneficiary ? <p className="mt-1 text-xs text-destructive">{formState.errors.beneficiary.message}</p> : null}
                  </div>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">القصة الكاملة</h2>
                <p className="text-sm text-subtle-foreground">
                  اشرح بالتفصيل为什么要 هذه الحملة، من المستفيد، وكيف ستُستخدم التبرعات.
                </p>
                <Textarea rows={12} {...register("story")} />
                {formState.errors.story ? <p className="mt-1 text-xs text-destructive">{formState.errors.story.message}</p> : null}
                <p className="text-xs text-subtle-foreground">{watch("story").length} / 8000 حرف</p>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">المعلومات المالية والغلاف</h2>
                <div>
                  <Label htmlFor="goalAmount">مبلغ الهدف (دج)</Label>
                  <Input id="goalAmount" type="number" {...register("goalAmount")} />
                  {formState.errors.goalAmount ? <p className="mt-1 text-xs text-destructive">{formState.errors.goalAmount.message}</p> : null}
                </div>
                <div>
                  <Label>صورة الغلاف</Label>
                  {coverPreview ? (
                    <img src={coverPreview} alt="" className="aspect-video w-full max-w-md rounded-xl border border-border object-cover" />
                  ) : (
                    <div className="flex aspect-video w-full max-w-md items-center justify-center rounded-xl border border-dashed border-border bg-secondary text-subtle-foreground">
                      <ImageIcon className="size-10" />
                    </div>
                  )}
                  <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent">
                    <Upload className="size-4" />
                    {coverFile ? "تغيير الصورة" : "رفع صورة"}
                    <input
                      type="file"
                      accept={Array.from(ALLOWED_IMAGE_MIME).join(",")}
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          if (f.size > MAX_IMAGE_BYTES) {
                            toast.error("الصورة كبيرة جداً.");
                            return;
                          }
                          void onCoverChange(f);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">المراجعة</h2>
                <p className="text-sm text-subtle-foreground">
                  هذا ما سيراه المتبرعون. ستدخل حملتك في المراجعة قبل النشر.
                </p>
                <CampaignPreview
                  data={{
                    title: watch("title"),
                    description: watch("description"),
                    story: watch("story"),
                    beneficiary: watch("beneficiary"),
                    category: categoryLabels[watch("category")],
                    wilaya: watch("wilaya"),
                    location: watch("location"),
                    goalAmount: Number(watch("goalAmount")),
                    coverImage: coverPreview,
                  }}
                />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="mt-6 flex justify-between">
          <Button
            variant="outline"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
          >
            <ChevronRight className="size-4" /> السابق
          </Button>
          {step < 4 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canAdvance(step)}>
              التالي <ChevronLeft className="size-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit((v) => submitMut.mutate(v))}
              disabled={submitMut.isPending}
            >
              {submitMut.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              إرسال للمراجعة
            </Button>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
