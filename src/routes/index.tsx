import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";

import { CampaignPage, CampaignPageSkeleton } from "@/components/hamla/campaign-page";

export const Route = createFileRoute("/")({
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
        content:
          "حملة تضامنية لمساعدة عائلة أحمد على إعادة بناء منزلها. تبرّع الآن وشارك الحملة.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <Suspense fallback={<CampaignPageSkeleton />}>
      <CampaignPage slug="aidez-famille-ahmed" />
    </Suspense>
  );
}
