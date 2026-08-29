import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AppRole = "user" | "charity_group" | "admin";

/**
 * Returns the role of the currently authenticated user.
 *
 * This is the ONLY role-exposing RPC for authenticated users. UI components
 * read this via the useRole() hook to render role-aware navigation. The
 * security-definer admin functions in the database use has_role() server-side.
 */
export const getMyRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data, error } = await supabase.rpc("get_my_role");
    if (error) {
      // get_my_role returns the first row for auth.uid(). If no row exists,
      // the user has no role yet — treat as 'user' (the default).
      return { role: "user" as AppRole };
    }
    const role = ((data ?? "user") as AppRole);
    return { role };
  });
