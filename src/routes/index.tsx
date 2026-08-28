import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { BadgeCheck, MapPin, ShieldCheck, Heart } from "lucide-react";
import { Suspense, useState } from "react";

import coverImage from "@/assets/campaign-cover.jpg";
import { DonateDialog } from "@/components/hamla/donate-dialog";
import { DonationCard } from "@/components/hamla/donation-card";
import { DonorLists } from "@/components/hamla/donor-list";
import { ShareDialog } from "@/components/hamla/share-dialog";
import { SiteFooter } from "@/components/hamla/site-footer";
import { SiteHeader } from "@/components/hamla/site-header";
import { CampaignStory } from "@/components/hamla/story";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCampaign } from "@/lib/campaign.functions";
import { formatDZD } from "@/lib/format";

const FEATURED_SLUG = "aidez-famille-ahmed";

const campaignQuery = queryOptions({
  queryKey: ["campaign", FEATURED_SLUG],
  queryFn: () => getCampaign({ data: { slug: FEATURED_SLUG } }),
});

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(campaignQuery),
  head: () => ({
    meta: [
      { title: "ساعدوا عائلة أحمد على تجاوز محنتهم | حملة" },
      {
        name: "description",
        content:
          "حملة تضامنية على منصة حملة لمساعدة عائلة أحمد على إعادة بناء منزلها بعد الحريق. تبرّع الآن وشارك الحملة.",
      },
      { property: "og:title", content: "ساعدوا عائلة أحمد على تجاوز محنتهم | حملة" },
      {
        property: "og:description",
        content: "حملة تضامنية لمساعدة عائلة أحمد على إعادة بناء منزلها. تبرّع الآن وشارك الحملة.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CampaignPage,
});

function CampaignPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CampaignContent />
    </Suspense>
  );
}

function PageSkeleton() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-[1240px] space-y-6 px-4 py-10 sm:px-6">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="aspect-video w-full rounded-xl" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}

function CampaignContent() {
  const { data: campaign } = useSuspenseQuery(campaignQuery);
  const [donateOpen, setDonateOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  if (!campaign) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <h1 className="text-xl font-semibold">الحملة غير متوفرة</h1>
          <p className="mt-2 text-sm text-subtle-foreground">
            قد تكون الحملة قد أُزيلت أو لم تُنشر بعد.
          </p>
        </div>
      </div>
    );
  }

  const raised = Number(campaign.raised_amount);
  const goal = Number(campaign.goal_amount);
  const cover = campaign.cover_image || coverImage;

  const openDonate = () => setDonateOpen(true);

  return (
    <div className="min-h-screen pb-24 lg:pb-0">
      <SiteHeader onDonate={openDonate} />

      <main className="mx-auto max-w-[1240px] px-4 pt-8 sm:px-6 lg:pt-12">
        <header className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {campaign.category ? (
              <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                {campaign.category}
              </span>
            ) : null}
            {campaign.verified ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 font-medium text-primary-strong">
                <BadgeCheck className="size-3.5" />
                حملة موثقة
              </span>
            ) : null}
            {campaign.location ? (
              <span className="inline-flex items-center gap-1 text-subtle-foreground">
                <MapPin className="size-3.5" />
                {campaign.location}
              </span>
            ) : null}
          </div>

          <h1 className="mt-4 text-3xl font-bold leading-snug tracking-tight sm:text-[2.1rem]">
            {campaign.title}
          </h1>
        </header>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px] lg:gap-12">
          {/* Main column */}
          <div className="min-w-0">
            <img
              src={cover}
              alt={campaign.title}
              className="aspect-video w-full rounded-xl border border-border object-cover"
            />

            <div className="mt-5 flex items-center gap-3">
              <Avatar className="size-11">
                <AvatarFallback className="bg-primary-soft text-sm font-semibold text-primary-strong">
                  {campaign.organizer_name.slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="text-sm">
                <p className="font-medium">
                  {campaign.organizer_name} ينظّم هذه الحملة
                  {campaign.beneficiary ? ` لصالح ${campaign.beneficiary}` : ""}.
                </p>
                {campaign.organizer_relation ? (
                  <p className="text-subtle-foreground">{campaign.organizer_relation}</p>
                ) : null}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-border py-4 text-xs text-subtle-foreground">
              {campaign.verified ? (
                <span className="inline-flex items-center gap-1.5">
                  <BadgeCheck className="size-4 text-primary-strong" />
                  هوية المنظّم ووثائق الحملة تم التحقق منها
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-primary-strong" />
                التبرعات محمية ويتم تحويلها عبر بوابة دفع رسمية
              </span>
            </div>

            <section id="story" className="mt-8">
              {campaign.description ? (
                <p className="mb-6 border-s-2 border-primary ps-4 text-base leading-loose text-foreground/85">
                  {campaign.description}
                </p>
              ) : null}
              <CampaignStory story={campaign.story ?? ""} />
            </section>

            <section id="how-it-works" className="mt-12 rounded-2xl bg-secondary p-6">
              <h2 className="text-base font-semibold">كيف تعمل منصة حملة؟</h2>
              <ol className="mt-4 space-y-3 text-sm leading-relaxed text-foreground/85">
                <li>
                  <span className="font-medium">1. توثيق الحملة —</span> نتحقق من هوية المنظّم
                  والوثائق قبل نشر الحملة.
                </li>
                <li>
                  <span className="font-medium">2. تبرّع آمن —</span> يمرّ الدفع عبر بوابة الدفع
                  الرسمية، ولا تُخزَّن بيانات بطاقتك عندنا.
                </li>
                <li>
                  <span className="font-medium">3. إيصال رسمي —</span> تستلم إيصال تبرع برقم فريد
                  فوراً بعد تأكيد الدفع.
                </li>
                <li>
                  <span className="font-medium">4. تحديثات وشفافية —</span> ينشر المنظّم تحديثات
                  دورية بفواتير المصاريف.
                </li>
              </ol>
            </section>

            <div className="mt-8 lg:hidden">
              <DonorLists slug={campaign.slug} donorCount={campaign.donor_count} />
            </div>
          </div>

          {/* Sidebar */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="space-y-6">
              <DonationCard
                raised={raised}
                goal={goal}
                donorCount={campaign.donor_count}
                onDonate={openDonate}
                onShare={() => setShareOpen(true)}
              />
              <div className="hidden lg:block">
                <DonorLists slug={campaign.slug} donorCount={campaign.donor_count} />
              </div>
            </div>
          </aside>
        </div>
      </main>

      <SiteFooter />

      {/* Mobile sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 p-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1 text-xs">
            <p className="truncate font-semibold">{formatDZD(raised)}</p>
            <p className="truncate text-subtle-foreground">من أصل {formatDZD(goal)}</p>
          </div>
          <Button className="h-11 flex-1" onClick={openDonate}>
            <Heart className="size-4" />
            تبرّع الآن
          </Button>
        </div>
      </div>

      <DonateDialog
        open={donateOpen}
        onOpenChange={setDonateOpen}
        slug={campaign.slug}
        campaignTitle={campaign.title}
      />
      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} title={campaign.title} />
    </div>
  );
}
