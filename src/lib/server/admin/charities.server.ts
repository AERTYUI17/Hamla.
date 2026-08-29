import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "@/lib/server/admin/guard.server";
import { logAdminAction } from "@/lib/server/audit.server";
import { CHARITY_DOCUMENTS_BUCKET } from "@/lib/storage-paths";

const listInput = z.object({ status: z.string().nullable().optional() });

export const listCharityApplications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => listInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    let q = supabaseAdmin
      .from("charity_applications")
      .select("id, org_name_ar, org_wilaya, submitted_at, status")
      .order("submitted_at", { ascending: false });
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error("تعذر تحميل الطلبات.");
    return rows ?? [];
  });

const idInput = z.object({ id: z.string().uuid() });

export const getCharityApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    const db = supabaseAdmin;
    const { data: app, error } = await db
      .from("charity_applications")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !app) throw new Error("الطلب غير موجود.");
    const { data: docs } = await db
      .from("charity_documents")
      .select("id, type, mime_type, size_bytes, original_filename, storage_path")
      .eq("charity_application_id", data.id)
      .order("uploaded_at", { ascending: true });
    return { application: app, documents: docs ?? [] };
  });

const docInput = z.object({ documentId: z.string().uuid() });

/**
 * Returns a server-redirect URL to a 5-minute signed URL of the document.
 * The raw storage path is NEVER returned to the client.
 */
export const getCharityDocumentSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => docInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    const db = supabaseAdmin;
    const { data: doc, error } = await db
      .from("charity_documents")
      .select("storage_path, original_filename")
      .eq("id", data.documentId)
      .maybeSingle();
    if (error || !doc) throw new Error("الوثيقة غير موجودة.");
    const { data: signed, error: signErr } = await db.storage
      .from(CHARITY_DOCUMENTS_BUCKET)
      .createSignedUrl(doc.storage_path, 300);
    if (signErr || !signed?.signedUrl) {
      throw new Error("تعذر إنشاء رابط التحميل.");
    }
    await logAdminAction({
      adminId: userId,
      action: "view_charity_document",
      targetType: "charity_document",
      targetId: data.documentId,
      metadata: { storage_path_prefix: doc.storage_path.split("/").slice(0, 3).join("/") },
    });
    return { url: signed.signedUrl, filename: doc.original_filename };
  });

const approveInput = z.object({ id: z.string().uuid(), notes: z.string().nullable().optional() });

export const approveCharityApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => approveInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    const { error } = await supabaseAdmin.rpc("approve_charity_application", {
      _application_id: data.id,
      _reviewer_id: userId,
      _notes: data.notes ?? null,
    });
    if (error) throw new Error(error.message || "تعذر قبول الطلب.");
    return { ok: true };
  });

const rejectInput = z.object({ id: z.string().uuid(), reason: z.string().min(10).max(500) });

export const rejectCharityApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => rejectInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    const { error } = await supabaseAdmin.rpc("reject_charity_application", {
      _application_id: data.id,
      _reviewer_id: userId,
      _reason: data.reason,
    });
    if (error) throw new Error(error.message || "تعذر رفض الطلب.");
    return { ok: true };
  });

const moreInfoInput = z.object({ id: z.string().uuid(), notes: z.string().min(10).max(500) });

export const requestMoreInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => moreInfoInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    const { error } = await supabaseAdmin.rpc("request_more_info", {
      _application_id: data.id,
      _reviewer_id: userId,
      _notes: data.notes,
    });
    if (error) throw new Error(error.message || "تعذر إرسال الطلب.");
    return { ok: true };
  });
