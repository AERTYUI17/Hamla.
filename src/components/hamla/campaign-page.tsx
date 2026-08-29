import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, ShieldCheck, MapPin, Heart } from "lucide-react";

import { SiteHeader } from "@/components/hamla/site-header";
import { SiteFooter } from "@/components/hamla/site-footer";
import { DonationCard } from "@/components/hamla/donation-card";
import { DonateDialog } from "@/components/hamla/donate-dialog";
import { DonorLists } from "@/components/hamla/donor-list";
import { ShareDialog } from "@/components/hamla/share-dialog";
import { CampaignStory } from "@/components/hamla/story";
import { CampaignCertifiedBadge, CharityVerifiedBadge } from "@/components/hamla/certified-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCampaignRealtime } from "@/lib/realtime";
import { getCampaign } from "@/lib/campaign.functions";
import { formatDZD } from "@/lib/format";

export function CampaignPage({ slug }: { slug: string }) {
  const fetch = useServerFn(getCampaign);
  const queryKey = ["campaign", slug] as const;
  const { data: campaign } = useQuery({
    queryKey,
    queryFn: () => fetch({ data: { slug } }),
  });

  useCampaignRealtime(campaign?.id ?? "", queryKey);

  const [donateOpen, setDonateOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  if (!campaign) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-md px-4 py-24 text-center">
          <h1 className="text-xl font-semibold">الحملة غير متوفرة</h1>
          <p className="mt-2 text-sm text-subtle-foreground">قد تكون الحملة قد أُزيلت أو لم تُنشر بعد.</p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const raised = Number(campaign.raised_amount);
  const goal = Number(campaign.goal_amount);
  const cover = campaign.cover_image;
  const openDonate = () => setDonateOpen(true);

  return (
    <div className="min-h-screen pb-24 lg:pb-0">
      <SiteHeader onDonate={openDonate} />

      <main className="mx-auto max-w-[1240px] px-4 pt-8 sm:px-6 lg:pt-12">
        <header className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {(campaign as any).category ? (
              <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                {(campaign as any).category}
              </span>
            ) : null}
            {campaign.certified ? <CampaignCertifiedBadge /> : null}
            {campaign.verified ? <CharityVerifiedBadge /> : null}
            {campaign.location ? (
              <span className="inline-flex items-center gap-1 text-subtle-foreground">
                <MapPin className="size-3.5" /> {campaign.location}
              </span>
            ) : null}
          </div>

          <h1 className="mt-4 text-3xl font-bold leading-snug tracking-tight sm:text-[2.1rem]">
            {campaign.title}
          </h1>
        </header>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px] lg:gap-12">
          <div className="min-w-0">
            <img
              src={cover || "/campaign-cover-placeholder.jpg"}
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

            <div className="mt-8 lg:hidden">
              <DonorLists slug={campaign.slug} donorCount={campaign.donor_count} />
            </div>
          </div>

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

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 p-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1 text-xs">
            <p className="truncate font-semibold">{formatDZD(raised)}</p>
            <p className="truncate text-subtle-foreground">من أصل {formatDZD(goal)}</p>
          </div>
          <Button className="h-11 flex-1" onClick={openDonate}>
            <Heart className="size-4" /> تبرّع الآن
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

export function CampaignPageSkeleton() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-[1240px] space-y-6 px-4 py-10 sm:px-6">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="aspect-video w-full rounded-xl" />
        <Skeleton className="h-40 w-full" />
      </div>
      <SiteFooter />
    </div>
  );
}
