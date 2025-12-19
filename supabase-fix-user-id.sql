-- Studio Jenial - Complete Schema Fix
-- Run this AFTER dropping existing tables OR run piece by piece
-- Execute in Supabase SQL Editor

-- =====================================================
-- OPTION 1: SAFE - Add missing columns to existing tables
-- =====================================================

-- Fix projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT 'anonymous';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS content_json JSONB;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS fps INTEGER DEFAULT 24;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS aspect TEXT DEFAULT '16:9';

-- Fix segments table (note: "order" is a reserved word, must be quoted)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'segments' AND column_name = 'order') THEN
    ALTER TABLE segments ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

-- =====================================================
-- OPTION 2: NUCLEAR - Drop and recreate (ONLY IF NO DATA)
-- Uncomment below if you want to start fresh
-- =====================================================

-- DROP TABLE IF EXISTS keyframes CASCADE;
-- DROP TABLE IF EXISTS segment_revisions CASCADE;
-- DROP TABLE IF EXISTS segments CASCADE;
-- DROP TABLE IF EXISTS assets CASCADE;
-- DROP TABLE IF EXISTS projects CASCADE;

-- Then run supabase-timeline-schema.sql

-- =====================================================
-- VERIFICATION
-- =====================================================

SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name IN ('projects', 'segments', 'assets')
ORDER BY table_name, ordinal_position;
