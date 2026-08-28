import { Menu, Plus, Search, X } from "lucide-react";
import { useState } from "react";

import { HamlaLogo } from "./logo";
import { Button } from "@/components/ui/button";
import { useAuth, displayNameOf } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export function SiteHeader({ onDonate }: { onDonate?: () => void }) {
  const [open, setOpen] = useState(false);
  const { user, loading } = useAuth();

  const signIn = async () => {
    const { lovable } = await import("@/integrations/lovable/index");
    await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-6 px-4 sm:px-6">
        <HamlaLogo />

        <nav className="hidden items-center gap-1 md:flex">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
          >
            <Search className="size-4" />
            بحث
          </button>
          <a
            href="#how-it-works"
            className="rounded-md px-3 py-2 text-sm text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
          >
            كيف تعمل؟
          </a>
          <a
            href="#story"
            className="rounded-md px-3 py-2 text-sm text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
          >
            الحملات
          </a>
        </nav>

        <div className="ms-auto hidden items-center gap-2 md:flex">
          {loading ? null : user ? (
            <>
              <span className="max-w-[140px] truncate text-sm text-subtle-foreground">
                {displayNameOf(user)}
              </span>
              <Button variant="ghost" size="sm" onClick={() => void supabase.auth.signOut()}>
                تسجيل الخروج
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => void signIn()}>
              تسجيل الدخول
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5">
            <Plus className="size-4" />
            إنشاء حملة
          </Button>
          <Button size="sm" onClick={onDonate}>
            تبرع الآن
          </Button>
        </div>

        <div className="ms-auto flex items-center gap-2 md:hidden">
          <Button size="sm" onClick={onDonate}>
            تبرع
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="القائمة"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-border bg-card px-4 pb-4 pt-2 md:hidden">
          <nav className="flex flex-col text-sm">
            <a href="#story" className="rounded-md px-2 py-3 hover:bg-accent">
              الحملات
            </a>
            <a href="#how-it-works" className="rounded-md px-2 py-3 hover:bg-accent">
              كيف تعمل؟
            </a>
            <button type="button" className="rounded-md px-2 py-3 text-start hover:bg-accent">
              إنشاء حملة
            </button>
            {user ? (
              <button
                type="button"
                className="rounded-md px-2 py-3 text-start hover:bg-accent"
                onClick={() => void supabase.auth.signOut()}
              >
                تسجيل الخروج
              </button>
            ) : (
              <button
                type="button"
                className="rounded-md px-2 py-3 text-start hover:bg-accent"
                onClick={() => void signIn()}
              >
                تسجيل الدخول
              </button>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
