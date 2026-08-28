import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

export interface AuthState {
  user: User | null;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setState({ user: session?.user ?? null, loading: false });
    });
    void supabase.auth.getUser().then(({ data }) => {
      if (active) setState({ user: data.user ?? null, loading: false });
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export function displayNameOf(user: User | null): string {
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const full = typeof meta["full_name"] === "string" ? meta["full_name"] : null;
  const name = typeof meta["name"] === "string" ? meta["name"] : null;
  return full ?? name ?? user?.email?.split("@")[0] ?? "متبرع";
}

export function avatarOf(user: User | null): string | null {
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const url = meta["avatar_url"];
  return typeof url === "string" ? url : null;
}
