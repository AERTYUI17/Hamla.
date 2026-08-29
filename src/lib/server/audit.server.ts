import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Writes a single row to public.audit_logs.
 *
 * The audit_logs table is append-only — there is a trigger that raises an
 * exception on UPDATE/DELETE. This helper is the only place application code
 * writes to audit_logs.
 *
 * The action string MUST be one of the audit_action enum values defined in
 * the database migration. The TypeScript type below mirrors the enum.
 */
export type AuditAction =
  | "approve_charity" | "reject_charity" | "suspend_charity"
  | "approve_campaign" | "reject_campaign" | "certify_campaign"
  | "remove_certification" | "suspend_campaign"
  | "approve_payout" | "reject_payout" | "mark_payout_paid"
  | "suspend_user" | "reactivate_user"
  | "view_charity_document";

export async function logAdminAction(params: {
  adminId: string;
  action: AuditAction;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("audit_logs").insert({
    admin_id: params.adminId,
    action: params.action,
    target_type: params.targetType,
    target_id: params.targetId,
    metadata: params.metadata ?? {},
  });
  if (error) {
    console.error("[audit] insert failed", error.message, params);
  }
}
