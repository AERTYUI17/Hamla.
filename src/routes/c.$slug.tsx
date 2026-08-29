import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";

import { CampaignPage, CampaignPageSkeleton } from "@/components/hamla/campaign-page";

export const Route = createFileRoute("/c/$slug")({
  head: ({ params }) => [
    { title: `حملة: ${params.slug} | حملة` },
  ],
  component: PublicCampaignRoute,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-2xl font-bold">404</h1>
        <p className="mt-1 text-sm text-subtle-foreground">الحملة غير متوفرة</p>
      </div>
    </div>
  ),
});

function PublicCampaignRoute() {
  const { slug } = Route.useParams();
  return (
    <Suspense fallback={<CampaignPageSkeleton />}>
      <CampaignPage slug={slug} />
    </Suspense>
  );
}
