import { useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth, displayNameOf } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export function AdminTopbar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const signOut = async () => {
    await supabase.auth.signOut();
    void navigate({ to: "/" });
  };
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur">
      <div className="text-sm">
        <p className="font-semibold">لوحة إدارة حملة</p>
      </div>
      <div className="flex items-center gap-2">
        {user ? (
          <span className="hidden text-sm text-subtle-foreground sm:inline">
            {displayNameOf(user)}
          </span>
        ) : null}
        <Button variant="ghost" size="sm" onClick={() => void signOut()}>
          <LogOut className="size-4" />
          خروج
        </Button>
      </div>
    </header>
  );
}
