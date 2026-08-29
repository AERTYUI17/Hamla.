import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  ALLOWED_DOCUMENT_MIME,
  CHARITY_DOCUMENTS_BUCKET,
  MAX_DOCUMENT_BYTES,
} from "@/lib/storage-paths";

const ALGERIAN_PHONE = /^(0)(5|6|7)[0-9]{8}$/;

const WILAYA_VALUES = [
  "أدرار","الشلف","الأغواط","أم البواقي","باتنة","بجاية","بسكرة","بشار","البليدة","البويرة",
  "تمنراست","تبسة","تلمسان","تيارت","تيزي وزو","الجزائر","الجلفة","جيجل","سطيف","سعيدة",
  "سكيكدة","سيدي بلعباس","عنابة","قالمة","قسنطينة","المدية","مستغانم","المسيلة","معسكر","ورقلة",
  "وهران","البيض","إليزي","برج بوعريريج","بومرداس","الطارف","تندوف","تيسمسيلت","الوادي","خنشلة",
  "سوق أهراس","تيبازة","ميلة","عين الدفلى","النعامة","عين تموشنت","غرداية","غليزان","تيميمون",
  "برج باجي مختار","أولاد جلال","بني عباس","عين صالح","عين قزام","تقرت","جانت","المغير","المنيعة",
] as const;

const categoryValues = ["education", "health", "family", "emergency", "orphan", "mosque", "other"] as const;

const documentInput = z.object({
  storagePath: z.string().min(8).max(500),
  mimeType: z.string().min(3).max(100),
  sizeBytes: z.number().int().positive().max(MAX_DOCUMENT_BYTES),
  originalFilename: z.string().min(1).max(200),
  type: z.string().min(1).max(50),
});

const applicationInput = z.object({
  orgName: z.string().min(3).max(120),
  orgNameAr: z.string().min(3).max(120),
  orgDescription: z.string().min(50).max(1000),
  orgCategory: z.enum(categoryValues),
  orgWilaya: z.enum(WILAYA_VALUES),
  orgCommune: z.string().min(2).max(80),
  orgAddress: z.string().min(5).max(200),
  orgPhone: z.string().regex(ALGERIAN_PHONE, "رقم الهاتف غير صالح"),
  orgEmail: z.string().email(),
  orgWebsite: z.string().url().max(200).optional().nullable(),
  repName: z.string().min(2).max(80),
  repPhone: z.string().regex(ALGERIAN_PHONE, "رقم الهاتف غير صالح"),
  repEmail: z.string().email(),
  registrationNumber: z.string().min(3).max(40),
  registrationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  documents: z.array(documentInput).min(1).max(10),
});

/**
 * Server-side re-validation of a charity application.
 *
 * The flow:
 *  1. The client uploads each file to the private `charity-documents` bucket
 *     at path `applications/{user_id}/draft/{uuid}.{ext}`.
 *  2. The client posts the form + the list of uploaded paths here.
 *  3. We re-validate the file: re-read the storage object's metadata, check
 *     size, MIME, that the path actually exists. We NEVER trust the client.
 *  4. We insert the charity_applications row with status='submitted'.
 *  5. We insert the charity_documents rows.
 *  6. We rename the storage objects from `draft/` to `{application_id}/`.
 *  7. We notify all admins.
 */
export const submitCharityApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => applicationInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const db = supabaseAdmin;

    const { data: existingApproved } = await db
      .from("charity_applications")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "approved")
      .maybeSingle();
    if (existingApproved) {
      throw new Error("لديك بالفعل طلب جمعية مقبول.");
    }

    for (const doc of data.documents) {
      const expectedPrefix = `applications/${userId}/draft/`;
      if (!doc.storagePath.startsWith(expectedPrefix)) {
        throw new Error("مسار ملف غير صالح.");
      }
      if (!ALLOWED_DOCUMENT_MIME.has(doc.mimeType)) {
        throw new Error("نوع ملف غير مسموح.");
      }
      if (doc.sizeBytes > MAX_DOCUMENT_BYTES) {
        throw new Error("حجم الملف يتجاوز الحد المسموح.");
      }
      const probeName = `applications/${userId}/_probe/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const { error: probeError } = await db.storage
        .from(CHARITY_DOCUMENTS_BUCKET)
        .copy(doc.storagePath, probeName);
      if (probeError) {
        throw new Error("تعذر التحقق من أحد الملفات المرفوعة.");
      }
      await db.storage.from(CHARITY_DOCUMENTS_BUCKET).remove([probeName]);
    }

    const { data: application, error: appError } = await db
      .from("charity_applications")
      .insert({
        user_id: userId,
        status: "submitted",
        org_name: data.orgName,
        org_name_ar: data.orgNameAr,
        org_description: data.orgDescription,
        org_category: data.orgCategory,
        org_wilaya: data.orgWilaya,
        org_commune: data.orgCommune,
        org_address: data.orgAddress,
        org_phone: data.orgPhone,
        org_email: data.orgEmail,
        org_website: data.orgWebsite ?? null,
        rep_name: data.repName,
        rep_phone: data.repPhone,
        rep_email: data.repEmail,
        registration_number: data.registrationNumber,
        registration_date: data.registrationDate,
      })
      .select("id")
      .single();
    if (appError || !application) {
      throw new Error("تعذر إنشاء طلب الجمعية. حاول مرة أخرى.");
    }

    const docRows = data.documents.map((d) => ({
      charity_application_id: application.id,
      type: d.type,
      storage_path: d.storagePath,
      mime_type: d.mimeType,
      size_bytes: d.sizeBytes,
      original_filename: d.originalFilename,
    }));
    const { error: docsError } = await db.from("charity_documents").insert(docRows);
    if (docsError) {
      throw new Error("تعذر تسجيل الوثائق. حاول مرة أخرى.");
    }

    for (const d of data.documents) {
      const ext = d.storagePath.slice(d.storagePath.lastIndexOf("."));
      const newPath = `applications/${userId}/${application.id}/${crypto.randomUUID()}${ext}`;
      const { error: moveError } = await db.storage
        .from(CHARITY_DOCUMENTS_BUCKET)
        .move(d.storagePath, newPath);
      if (moveError) {
        console.error("storage move failed", moveError);
        continue;
      }
      await db
        .from("charity_documents")
        .update({ storage_path: newPath })
        .eq("charity_application_id", application.id)
        .eq("storage_path", d.storagePath);
    }

    const { data: admins } = await db
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    if (admins && admins.length > 0) {
      await db.from("notifications").insert(
        admins.map((a) => ({
          user_id: a.user_id,
          type: "charity_application_submitted",
          title: "طلب جمعية جديد",
          message: `قدم "${data.orgNameAr}" طلبًا للحصول على صفة جمعية خيرية.`,
        })),
      );
    }

    return { applicationId: application.id };
  });

const statusInput = z.object({});

/**
 * Returns the latest charity application submitted by the current user, with
 * admin notes and a localized status label.
 */
export const getMyCharityApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => statusInput.parse(data ?? {}))
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    const { data: app } = await supabaseAdmin
      .from("charity_applications")
      .select(
        "id, status, admin_notes, submitted_at, reviewed_at, org_name_ar",
      )
      .eq("user_id", userId)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return app ?? null;
  });
