/**
 * Storage path conventions for HAMLA's private buckets.
 *
 * charity-documents bucket:
 *   applications/{user_id}/{application_id}/{uuid}.{ext}
 *
 * campaign-images bucket:
 *   campaigns/{charity_group_id}/{uuid}.{ext}
 *
 * These helpers produce and parse these paths. They are used by both the
 * client (for the upload) and the server (for re-validation). Keep them in
 * sync with the RLS policies in
 * supabase/migrations/20260829000001_storage_buckets.sql.
 */

import { randomUUID } from "node:crypto";

export const CHARITY_DOCUMENTS_BUCKET = "charity-documents";
export const CAMPAIGN_IMAGES_BUCKET = "campaign-images";

export function buildCharityDocumentPath(
  userId: string,
  applicationId: string,
  originalFilename: string,
): string {
  const ext = extensionFromFilename(originalFilename);
  return `applications/${userId}/${applicationId}/${randomUUID()}${ext}`;
}

export function buildCampaignImagePath(
  charityGroupId: string,
  originalFilename: string,
): string {
  const ext = extensionFromFilename(originalFilename);
  return `campaigns/${charityGroupId}/${randomUUID()}${ext}`;
}

export function extensionFromFilename(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot < 0 || lastDot === filename.length - 1) return "";
  return filename.slice(lastDot).toLowerCase();
}

export const ALLOWED_DOCUMENT_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

export const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
