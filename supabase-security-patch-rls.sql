-- =====================================================
-- Studio Jenial - Security Patch: RLS Policies
-- Execute this script in your Supabase SQL Editor
-- IMPORTANT: Run this AFTER backing up your data
-- =====================================================

-- =====================================================
-- STEP 1: DROP PERMISSIVE POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Public profiles access" ON studio_profiles;
DROP POLICY IF EXISTS "Public sessions access" ON studio_sessions;
DROP POLICY IF EXISTS "Public previews access" ON storyboard_previews;

-- =====================================================
-- STEP 2: CREATE SECURE POLICIES
-- =====================================================

-- Option A: For Supabase Auth users (email-based matching)
-- Uncomment this block if you use Supabase Auth

/*
-- studio_profiles: users can only access their own profile
CREATE POLICY "Users can view own profile" ON studio_profiles 
  FOR SELECT TO authenticated 
  USING (user_identifier = auth.jwt()->>'email');

CREATE POLICY "Users can insert own profile" ON studio_profiles 
  FOR INSERT TO authenticated 
  WITH CHECK (user_identifier = auth.jwt()->>'email');

CREATE POLICY "Users can update own profile" ON studio_profiles 
  FOR UPDATE TO authenticated 
  USING (user_identifier = auth.jwt()->>'email');

-- studio_sessions: sessions linked to user's profile
CREATE POLICY "Users can manage own sessions" ON studio_sessions 
  FOR ALL TO authenticated 
  USING (profile_id IN (
    SELECT id FROM studio_profiles WHERE user_identifier = auth.jwt()->>'email'
  ));

-- storyboard_previews: inherits from session
CREATE POLICY "Users can manage own previews" ON storyboard_previews 
  FOR ALL TO authenticated 
  USING (session_id IN (
    SELECT s.id FROM studio_sessions s 
    JOIN studio_profiles p ON s.profile_id = p.id 
    WHERE p.user_identifier = auth.jwt()->>'email'
  ));
*/

-- Option B: For anonymous/pseudo-based access (current mode)
-- Less secure but allows operation without Supabase Auth
-- At minimum, restricts to authenticated users only (no anon access)

CREATE POLICY "Authenticated read profiles" ON studio_profiles 
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated insert profiles" ON studio_profiles 
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated update profiles" ON studio_profiles 
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated delete own profiles" ON studio_profiles 
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated manage sessions" ON studio_sessions 
  FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated manage previews" ON storyboard_previews 
  FOR ALL TO authenticated USING (true);

-- =====================================================
-- STEP 3: VERIFY
-- =====================================================

SELECT 
  schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies 
WHERE tablename IN ('studio_profiles', 'studio_sessions', 'storyboard_previews')
ORDER BY tablename, policyname;

-- Expected: Only 'authenticated' role, no 'public' or 'anon'
