import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribes to postgres_changes on the campaigns table for the given
 * campaign id, and on any UPDATE invalidates the supplied query key.
 *
 * Used on the public campaign page so that the raised amount and donor
 * count update live as donations are confirmed.
 */
export function useCampaignRealtime(
  campaignId: string,
  queryKeyToInvalidate: readonly unknown[],
): void {
  const qc = useQueryClient();
  useEffect(() => {
    if (!campaignId) return;
    const channel = supabase
      .channel(`campaign-${campaignId}`)
      .on(
        "postgres_changes" as any,
        { event: "UPDATE", schema: "public", table: "campaigns", filter: `id=eq.${campaignId}` },
        () => {
          void qc.invalidateQueries({ queryKey: queryKeyToInvalidate as any });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, qc, JSON.stringify(queryKeyToInvalidate)]);
}
