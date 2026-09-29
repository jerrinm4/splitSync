-- Drop the overly broad SELECT policy to prevent directory listing
-- Since the bucket is public, getPublicUrl works without any RLS policy,
-- and users do not need to list the contents of the bucket.
DROP POLICY IF EXISTS "Public Receipt Access" ON storage.objects;
