-- Studio Jenial - Timeline Schema Migration
-- Segment = Objet IA - Data Model
-- Execute this script in your Supabase SQL Editor
-- =====================================================

-- =====================================================
-- ÉTAPE 1: TABLE PROJECTS
-- =====================================================

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL DEFAULT 'anonymous',
  title TEXT NOT NULL DEFAULT 'Untitled Project',
  fps INTEGER NOT NULL DEFAULT 24 CHECK (fps IN (24, 25, 30)),
  aspect TEXT NOT NULL DEFAULT '16:9' CHECK (aspect IN ('16:9', '9:16', '1:1')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for user queries
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

-- =====================================================
-- ÉTAPE 2: TABLE ASSETS (centralized storage refs)
-- =====================================================

CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('image', 'video')),
  storage_path TEXT NOT NULL,
  mime TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  duration_sec NUMERIC(10, 3),
  file_size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for storage path lookups
CREATE INDEX IF NOT EXISTS idx_assets_storage_path ON assets(storage_path);

-- =====================================================
-- ÉTAPE 3: TABLE SEGMENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  "order" INTEGER NOT NULL DEFAULT 0,
  in_sec NUMERIC(10, 3) NOT NULL DEFAULT 0,
  out_sec NUMERIC(10, 3) NOT NULL DEFAULT 5,
  active_revision_id UUID, -- will be set after first revision
  label TEXT,
  locked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_segments_project_id ON segments(project_id);
CREATE INDEX IF NOT EXISTS idx_segments_order ON segments(project_id, "order");

-- =====================================================
-- ÉTAPE 4: TABLE SEGMENT_REVISIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS segment_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id UUID NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
  parent_revision_id UUID REFERENCES segment_revisions(id) ON DELETE SET NULL,
  
  -- Provider
  provider TEXT NOT NULL DEFAULT 'veo' CHECK (provider IN ('veo', 'kling-omni', 'runway', 'nano-fast', 'nano-pro')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'queued', 'running', 'succeeded', 'failed')),
  
  -- Prompt (stored as JSONB for flexibility)
  prompt_json JSONB NOT NULL DEFAULT '{"rootPrompt": ""}',
  
  -- Asset references
  base_asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  output_asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  
  -- Metrics & errors (JSONB)
  metrics_json JSONB,
  error_json JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_segment_revisions_segment_id ON segment_revisions(segment_id);
CREATE INDEX IF NOT EXISTS idx_segment_revisions_status ON segment_revisions(status);

-- =====================================================
-- ÉTAPE 5: TABLE KEYFRAMES
-- =====================================================

CREATE TABLE IF NOT EXISTS keyframes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id UUID NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
  revision_id UUID NOT NULL REFERENCES segment_revisions(id) ON DELETE CASCADE,
  t_sec NUMERIC(10, 3) NOT NULL DEFAULT 0,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_keyframes_segment_id ON keyframes(segment_id);
CREATE INDEX IF NOT EXISTS idx_keyframes_revision_id ON keyframes(revision_id);

-- =====================================================
-- ÉTAPE 6: FOREIGN KEY - segments.active_revision_id
-- =====================================================

ALTER TABLE segments 
ADD CONSTRAINT fk_segments_active_revision 
FOREIGN KEY (active_revision_id) 
REFERENCES segment_revisions(id) 
ON DELETE SET NULL;

-- =====================================================
-- ÉTAPE 7: ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE segment_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE keyframes ENABLE ROW LEVEL SECURITY;

-- For now, allow public access (same as existing buckets)
-- TODO: Add proper auth policies when auth is implemented

CREATE POLICY "Public read projects" ON projects FOR SELECT USING (true);
CREATE POLICY "Public insert projects" ON projects FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update projects" ON projects FOR UPDATE USING (true);
CREATE POLICY "Public delete projects" ON projects FOR DELETE USING (true);

CREATE POLICY "Public read segments" ON segments FOR SELECT USING (true);
CREATE POLICY "Public insert segments" ON segments FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update segments" ON segments FOR UPDATE USING (true);
CREATE POLICY "Public delete segments" ON segments FOR DELETE USING (true);

CREATE POLICY "Public read segment_revisions" ON segment_revisions FOR SELECT USING (true);
CREATE POLICY "Public insert segment_revisions" ON segment_revisions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update segment_revisions" ON segment_revisions FOR UPDATE USING (true);
CREATE POLICY "Public delete segment_revisions" ON segment_revisions FOR DELETE USING (true);

CREATE POLICY "Public read assets" ON assets FOR SELECT USING (true);
CREATE POLICY "Public insert assets" ON assets FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update assets" ON assets FOR UPDATE USING (true);
CREATE POLICY "Public delete assets" ON assets FOR DELETE USING (true);

CREATE POLICY "Public read keyframes" ON keyframes FOR SELECT USING (true);
CREATE POLICY "Public insert keyframes" ON keyframes FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update keyframes" ON keyframes FOR UPDATE USING (true);
CREATE POLICY "Public delete keyframes" ON keyframes FOR DELETE USING (true);

-- =====================================================
-- ÉTAPE 8: UPDATED_AT TRIGGER
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_segments_updated_at
  BEFORE UPDATE ON segments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VÉRIFICATION
-- =====================================================

SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('projects', 'segments', 'segment_revisions', 'assets', 'keyframes')
ORDER BY table_name;

-- =====================================================
-- RÉSULTAT ATTENDU
-- =====================================================
-- 5 tables: assets, keyframes, projects, segment_revisions, segments
-- ✅ Migration réussie!
