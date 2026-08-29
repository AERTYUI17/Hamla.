import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";

import { AdminSidebar } from "@/components/hamla/admin-sidebar";
import { AdminTopbar } from "@/components/hamla/admin-topbar";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getMyRole } from "@/lib/auth.functions";

/**
 * /admin layout. Server-side gate via getMyRole: non-admins get 404.
 * The 404 is rendered by this component (not via a redirect) so the URL
 * stays at /admin and the user cannot infer that admin routes exist.
 */
export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      throw redirect({ to: "/" });
    }
  },
  component: AdminLayoutShell,
});

function NotAdmin() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-2xl font-bold">404</h1>
        <p className="mt-1 text-sm text-subtle-foreground">الصفحة غير موجودة</p>
      </div>
    </div>
  );
}

function AdminLayoutShell() {
  const { user, loading: authLoading } = useAuth();
  const fetchRole = useServerFn(getMyRole);

  const roleQuery = useQuery({
    queryKey: ["my-role-admin-check"],
    queryFn: () => fetchRole({ data: undefined }),
    enabled: Boolean(user),
  });

  if (authLoading || (user && roleQuery.isPending)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <NotAdmin />;
  }

  if (roleQuery.data && roleQuery.data.role !== "admin") {
    return <NotAdmin />;
  }

  return (
    <div className="flex min-h-screen bg-secondary">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar />
        <main className="flex-1 overflow-x-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
