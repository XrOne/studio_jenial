-- Studio Jenial - Session & Persistence Setup
-- Execute this script in your Supabase SQL Editor
-- Project: wiwbdccdmbcyjfjtglvi

-- =====================================================
-- ÉTAPE 1: TABLES PROFILS & SESSIONS
-- =====================================================

-- Table: studio_profiles (Utilisateurs persistants)
CREATE TABLE IF NOT EXISTS studio_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_identifier TEXT UNIQUE NOT NULL, -- pseudo ou email
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: studio_sessions (États de travail)
CREATE TABLE IF NOT EXISTS studio_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES studio_profiles(id) ON DELETE CASCADE,
  name TEXT, -- Nom optionnel (ex: "Session du 14/12")
  
  -- Prompt Sequence Data
  main_prompt TEXT,
  extension_prompts JSONB DEFAULT '[]'::jsonb,
  dirty_extensions JSONB DEFAULT '[]'::jsonb,
  active_prompt_index INT DEFAULT 0,
  
  -- Dogma Data
  dogma_id TEXT,
  dogma_snapshot JSONB, -- Copie complète du dogma au moment de la save
  
  -- Video Data (URLs & status)
  sequence_video_data JSONB DEFAULT '{}'::jsonb,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_sessions_profile ON studio_sessions(profile_id);
CREATE INDEX IF NOT EXISTS idx_sessions_activity ON studio_sessions(last_activity_at DESC);

-- =====================================================
-- ÉTAPE 2: TABLE STORYBOARD PREVIEWS (NANO)
-- =====================================================

CREATE TABLE IF NOT EXISTS storyboard_previews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES studio_sessions(id) ON DELETE CASCADE,
  
  owner TEXT CHECK (owner IN ('root', 'extension', 'character')),
  segment_index INT,
  character_id TEXT,
  
  -- Images (URLs stockées dans bucket 'images' ou 'thumbnails')
  base_image_url TEXT,
  preview_image_url TEXT NOT NULL,
  
  -- Content
  preview_prompt TEXT,
  camera_notes TEXT,
  movement_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_previews_session ON storyboard_previews(session_id);

-- =====================================================
-- ÉTAPE 3: RLS POLICIES (PUBLIC ACCESS FOR NOW)
-- =====================================================
-- Note: Dans un environnement prod strict, on utiliserait l'Auth Supabase.
-- Ici, on permet l'accès public pour simplifier le prototype, 
-- mais on pourrait restreindre par IP ou header plus tard.

ALTER TABLE studio_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE storyboard_previews ENABLE ROW LEVEL SECURITY;

-- Allow all (Anonymous access pattern for Studio Jenial)
CREATE POLICY "Public profiles access" ON studio_profiles FOR ALL USING (true);
CREATE POLICY "Public sessions access" ON studio_sessions FOR ALL USING (true);
CREATE POLICY "Public previews access" ON storyboard_previews FOR ALL USING (true);

-- =====================================================
-- ÉTAPE 4: VÉRIFICATION
-- =====================================================

SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('studio_profiles', 'studio_sessions', 'storyboard_previews');
