import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SiteHeader } from "@/components/hamla/site-header";
import { SiteFooter } from "@/components/hamla/site-footer";

export const Route = createFileRoute("/c")({
  component: () => (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-[1240px] px-4 py-8 sm:px-6">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  ),
});
