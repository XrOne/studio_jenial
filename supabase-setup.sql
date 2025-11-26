-- Studio Jenial - Supabase Storage Configuration
-- Execute this script in your Supabase SQL Editor
-- Project: wiwbdccdmbcyjfjtglvi

-- =====================================================
-- ÉTAPE 1: CRÉER LES BUCKETS DE STOCKAGE
-- =====================================================

-- Bucket pour les vidéos générées
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Bucket pour les images générées
INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Bucket pour les thumbnails
INSERT INTO storage.buckets (id, name, public)
VALUES ('thumbnails', 'thumbnails', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- =====================================================
-- ÉTAPE 2: CRÉER LES POLICIES D'ACCÈS PUBLIC
-- =====================================================

-- Politique de lecture publique pour videos
DROP POLICY IF EXISTS "Public Access to Videos" ON storage.objects;
CREATE POLICY "Public Access to Videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'videos');

-- Politique d'upload pour videos
DROP POLICY IF EXISTS "Allow Uploads to Videos" ON storage.objects;
CREATE POLICY "Allow Uploads to Videos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'videos');

-- Politique de lecture publique pour images
DROP POLICY IF EXISTS "Public Access to Images" ON storage.objects;
CREATE POLICY "Public Access to Images"
ON storage.objects FOR SELECT
USING (bucket_id = 'images');

-- Politique d'upload pour images
DROP POLICY IF EXISTS "Allow Uploads to Images" ON storage.objects;
CREATE POLICY "Allow Uploads to Images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'images');

-- Politique de lecture publique pour thumbnails
DROP POLICY IF EXISTS "Public Access to Thumbnails" ON storage.objects;
CREATE POLICY "Public Access to Thumbnails"
ON storage.objects FOR SELECT
USING (bucket_id = 'thumbnails');

-- Politique d'upload pour thumbnails
DROP POLICY IF EXISTS "Allow Uploads to Thumbnails" ON storage.objects;
CREATE POLICY "Allow Uploads to Thumbnails"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'thumbnails');

-- =====================================================
-- ÉTAPE 3: VÉRIFICATION
-- =====================================================

-- Vérifier que les buckets ont été créés
SELECT 
  id, 
  name, 
  public,
  created_at
FROM storage.buckets 
WHERE id IN ('videos', 'images', 'thumbnails')
ORDER BY name;

-- Vérifier les policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'objects' 
  AND (policyname LIKE '%Videos%' 
    OR policyname LIKE '%Images%' 
    OR policyname LIKE '%Thumbnails%')
ORDER BY policyname;

-- =====================================================
-- RÉSULTAT ATTENDU
-- =====================================================
-- Vous devriez voir:
-- - 3 buckets (videos, images, thumbnails) avec public = true
-- - 6 policies (2 par bucket: SELECT et INSERT)
-- 
-- ✅ Si c'est le cas, la configuration est terminée!
