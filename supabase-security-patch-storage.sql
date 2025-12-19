-- Studio Jenial - Security Patch: Private Storage
-- Execute this in Supabase SQL Editor
-- WARNING: After running, old public URLs will stop working

-- Make buckets private
UPDATE storage.buckets SET public = false WHERE id IN ('videos', 'images', 'thumbnails');

-- Drop old permissive policies
DROP POLICY IF EXISTS "Public Access to Videos" ON storage.objects;
DROP POLICY IF EXISTS "Public Access to Images" ON storage.objects;
DROP POLICY IF EXISTS "Public Access to Thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Allow Uploads to Videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow Uploads to Images" ON storage.objects;
DROP POLICY IF EXISTS "Allow Uploads to Thumbnails" ON storage.objects;

-- Create authenticated-only policies
CREATE POLICY "Auth read videos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'videos');
CREATE POLICY "Auth upload videos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'videos');
CREATE POLICY "Auth read images" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'images');
CREATE POLICY "Auth upload images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'images');
CREATE POLICY "Auth read thumbnails" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'thumbnails');
CREATE POLICY "Auth upload thumbnails" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'thumbnails');
