import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Wallet, ListChecks, BarChart3, User2 } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getMyCharityGroup } from "@/lib/server/charity/dashboard.server";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/charity")({
  beforeLoad: async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) throw redirect({ to: "/" });
  },
  component: CharityLayoutShell,
});

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-2xl font-bold">404</h1>
        <p className="mt-1 text-sm text-subtle-foreground">الصفحة غير موجودة</p>
      </div>
    </div>
  );
}

function CharityLayoutShell() {
  const { user, loading: authLoading } = useAuth();
  const fetch = useServerFn(getMyCharityGroup);

  const q = useQuery({
    queryKey: ["my-charity-group"],
    queryFn: () => fetch({ data: {} }),
    enabled: Boolean(user),
  });

  if (authLoading || (user && q.isPending)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <NotFound />;
  if (!q.data || !q.data.verified) return <NotFound />;

  const pathname = typeof window !== "undefined" ? window.location.pathname : "";

  const links = [
    { to: "/charity", label: "لوحة التحكم", icon: ListChecks },
    { to: "/charity/campaigns", label: "حملاتي", icon: ListChecks },
    { to: "/charity/payouts", label: "السحوبات", icon: Wallet },
    { to: "/charity/profile", label: "الملف الشخصي", icon: User2 },
  ];

  return (
    <div className="flex min-h-screen bg-secondary">
      <aside className="hidden w-60 shrink-0 border-l border-border bg-card md:flex md:flex-col">
        <div className="flex h-16 items-center gap-2 border-b border-border px-4">
          <span className="grid size-9 place-items-center rounded-md bg-primary-soft text-primary-strong">
            <BarChart3 className="size-4" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold truncate">{q.data.name}</p>
            <p className="text-[10px] text-subtle-foreground">لوحة الجمعية</p>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 p-2 text-sm">
          {links.map((l) => {
            const active = pathname === l.to;
            const Icon = l.icon;
            return (
              <Link
                key={l.to}
                to={l.to}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 transition-colors",
                  active ? "bg-primary-soft text-primary-strong" : "text-foreground/80 hover:bg-accent",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {l.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur">
          <p className="text-sm font-semibold">لوحة تحكم الجمعية</p>
        </header>
        <main className="flex-1 overflow-x-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
