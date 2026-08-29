-- HAMLA storage buckets (Part 1)
-- Two private buckets: charity-documents and campaign-images.
-- Fallback: if SQL bucket creation fails in your Supabase project,
-- create these manually in Storage > New bucket > Private, then re-run
-- the policy portion of this file.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('charity-documents', 'charity-documents', false, 10485760,
    ARRAY['application/pdf', 'image/jpeg', 'image/png']::text[]),
  ('campaign-images', 'campaign-images', false, 10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp']::text[])
ON CONFLICT (id) DO NOTHING;

-- RLS for charity-documents: authenticated can INSERT at paths under applications/{auth.uid()}/
CREATE POLICY "charity_documents_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'charity-documents'
    AND (storage.foldername(name))[1] = 'applications'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- RLS for campaign-images: authenticated charity owners can INSERT at paths under campaigns/{their_charity_id}/
CREATE POLICY "campaign_images_insert_owner" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'campaign-images'
    AND (storage.foldername(name))[1] = 'campaigns'
    AND (storage.foldername(name))[2] IN (
      SELECT id::text FROM public.charity_groups WHERE user_id = auth.uid()
    )
  );

-- No SELECT policies on storage.objects for these buckets.
-- Reads go through service_role via signed URLs only.
