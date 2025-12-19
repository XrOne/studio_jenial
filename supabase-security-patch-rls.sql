-- Studio Jenial - Security Patch: RLS Policies
-- Execute this in Supabase SQL Editor

-- Drop permissive policies
DROP POLICY IF EXISTS "Public profiles access" ON studio_profiles;
DROP POLICY IF EXISTS "Public sessions access" ON studio_sessions;
DROP POLICY IF EXISTS "Public previews access" ON storyboard_previews;

-- Create authenticated-only policies
CREATE POLICY "Authenticated access profiles" ON studio_profiles 
  FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated access sessions" ON studio_sessions 
  FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated access previews" ON storyboard_previews 
  FOR ALL TO authenticated USING (true);
