import { useEffect, useState } from "react";

import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { getMyRole, type AppRole } from "@/lib/auth.functions";

export type RoleState =
  | { status: "loading"; role: null }
  | { status: "ready"; role: AppRole }
  | { status: "anonymous"; role: null };

export function useRole(): RoleState {
  const fetchRole = useServerFn(getMyRole);
  const [state, setState] = useState<RoleState>({ status: "loading", role: null });

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (!session) {
        setState({ status: "anonymous", role: null });
        return;
      }
      fetchRole({ data: undefined })
        .then((res) => {
          if (!active) return;
          setState({ status: "ready", role: res.role });
        })
        .catch(() => {
          if (!active) return;
          setState({ status: "ready", role: "user" });
        });
    });
    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      if (!data.user) {
        setState({ status: "anonymous", role: null });
        return;
      }
      fetchRole({ data: undefined })
        .then((res) => {
          if (!active) return;
          setState({ status: "ready", role: res.role });
        })
        .catch(() => {
          if (!active) return;
          setState({ status: "ready", role: "user" });
        });
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [fetchRole]);

  return state;
}
