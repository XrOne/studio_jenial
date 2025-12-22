-- Studio Jenial - Definitive Database Schema v2.3
-- FIXED: Explicit UUID casting via helper function

-- ============================================
-- 1. UUID HELPER FUNCTION (Run this first!)
-- ============================================
CREATE OR REPLACE FUNCTION public.current_user_id() 
RETURNS uuid 
LANGUAGE sql 
STABLE 
SECURITY DEFINER 
SET search_path = public
AS $$
  SELECT auth.uid()::uuid;
$$;

-- ============================================
-- 2. PROJECTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Project',
  description TEXT,
  content_json JSONB DEFAULT NULL,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own projects" ON projects;
DROP POLICY IF EXISTS "Users can create own projects" ON projects;
DROP POLICY IF EXISTS "Users can update own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON projects;

CREATE POLICY "Users can view own projects" ON projects FOR SELECT USING (user_id = public.current_user_id());
CREATE POLICY "Users can create own projects" ON projects FOR INSERT WITH CHECK (user_id = public.current_user_id());
CREATE POLICY "Users can update own projects" ON projects FOR UPDATE USING (user_id = public.current_user_id()) WITH CHECK (user_id = public.current_user_id());
CREATE POLICY "Users can delete own projects" ON projects FOR DELETE USING (user_id = public.current_user_id());

-- ============================================
-- 3. PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  api_key TEXT,
  preferences JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (id = public.current_user_id());
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (id = public.current_user_id()) WITH CHECK (id = public.current_user_id());
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (id = public.current_user_id());

-- ============================================
-- 4. SHOTS TABLE (Shot Library)
-- ============================================
CREATE TABLE IF NOT EXISTS shots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'Untitled Shot',
  prompt TEXT NOT NULL,
  thumbnail TEXT, -- base64 data
  model TEXT,
  aspect_ratio TEXT,
  resolution TEXT,
  mode TEXT,
  video_url TEXT,
  preview_image_base64 TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE shots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own shots" ON shots;
DROP POLICY IF EXISTS "Users can create own shots" ON shots;
DROP POLICY IF EXISTS "Users can update own shots" ON shots;
DROP POLICY IF EXISTS "Users can delete own shots" ON shots;

-- Allow viewing shots if they are yours OR if they have no user_id (legacy)
CREATE POLICY "Users can view own shots" ON shots FOR SELECT USING (user_id IS NULL OR user_id = public.current_user_id());
CREATE POLICY "Users can create own shots" ON shots FOR INSERT WITH CHECK (user_id = public.current_user_id());
CREATE POLICY "Users can update own shots" ON shots FOR UPDATE USING (user_id = public.current_user_id()) WITH CHECK (user_id = public.current_user_id());
CREATE POLICY "Users can delete own shots" ON shots FOR DELETE USING (user_id = public.current_user_id());

-- ============================================
-- 5. TRIGGER FOR NEW USERS
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id, 
    NEW.email, 
    NEW.raw_user_meta_data->>'full_name', 
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
