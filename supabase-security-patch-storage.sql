-- =====================================================
-- Studio Jenial - Security Patch: Private Storage
-- Execute this script in your Supabase SQL Editor
-- IMPORTANT: After running, update code to use signed URLs
-- =====================================================

-- =====================================================
-- STEP 1: MAKE BUCKETS PRIVATE
-- =====================================================

UPDATE storage.buckets 
SET public = false 
WHERE id IN ('videos', 'images', 'thumbnails');

-- =====================================================
-- STEP 2: DROP OVERLY PERMISSIVE POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Public Access to Videos" ON storage.objects;
DROP POLICY IF EXISTS "Public Access to Images" ON storage.objects;
DROP POLICY IF EXISTS "Public Access to Thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Allow Uploads to Videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow Uploads to Images" ON storage.objects;
DROP POLICY IF EXISTS "Allow Uploads to Thumbnails" ON storage.objects;

-- =====================================================
-- STEP 3: CREATE USER-SCOPED POLICIES
-- =====================================================

-- For now: Allow any authenticated user to upload/read
-- (Stricter per-user policies require path format: {user_id}/filename)

-- Videos bucket
CREATE POLICY "Authenticated users can read videos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'videos');

CREATE POLICY "Authenticated users can upload videos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'videos');

CREATE POLICY "Authenticated users can delete own videos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'videos');

-- Images bucket
CREATE POLICY "Authenticated users can read images" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'images');

CREATE POLICY "Authenticated users can upload images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'images');

CREATE POLICY "Authenticated users can delete own images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'images');

-- Thumbnails bucket
CREATE POLICY "Authenticated users can read thumbnails" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'thumbnails');

CREATE POLICY "Authenticated users can upload thumbnails" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'thumbnails');

CREATE POLICY "Authenticated users can delete own thumbnails" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'thumbnails');

-- =====================================================
-- STEP 4: VERIFY
-- =====================================================

-- Check buckets are private
SELECT id, name, public FROM storage.buckets 
WHERE id IN ('videos', 'images', 'thumbnails');
-- Expected: public = false for all

-- Check policies
SELECT policyname, cmd, roles 
FROM pg_policies 
WHERE tablename = 'objects' 
  AND policyname LIKE '%videos%' 
   OR policyname LIKE '%images%' 
   OR policyname LIKE '%thumbnails%';
-- Expected: Only 'authenticated' role

-- =====================================================
-- NOTES
-- =====================================================
-- After running this:
-- 1. Old public URLs will STOP WORKING
-- 2. Use getSignedUrl() in code to generate temporary URLs
-- 3. Signed URLs expire after 1 hour by default
