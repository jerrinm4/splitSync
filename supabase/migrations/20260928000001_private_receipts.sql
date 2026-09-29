-- Existing public URLs stop working after this migration. Objects stay in place.
UPDATE storage.buckets SET public = false WHERE id = 'receipts';
DROP POLICY IF EXISTS "Public Receipt Access" ON storage.objects;

CREATE POLICY receipt_read ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'receipts' AND EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.id::text = (storage.foldername(storage.objects.name))[1]
      AND public.is_trip_admin(t.id)
  )
);
