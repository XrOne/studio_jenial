-- =====================================================
-- Studio Jenial - Security Patch: approve_beta_request
-- Execute this script in your Supabase SQL Editor
-- IMPORTANT: Creates admin_users table if not exists
-- =====================================================

-- =====================================================
-- STEP 1: CREATE ADMIN USERS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on admin table
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Only admins can read admin list
CREATE POLICY "Admins can view admin list" ON public.admin_users
  FOR SELECT TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- =====================================================
-- STEP 2: REPLACE INSECURE FUNCTION
-- =====================================================

-- Drop the old function first
DROP FUNCTION IF EXISTS approve_beta_request(TEXT, UUID);

-- Create secure version with authorization checks
CREATE OR REPLACE FUNCTION approve_beta_request(request_email TEXT, admin_id UUID)
RETURNS VOID AS $$
BEGIN
  -- SECURITY: Verify caller matches the declared admin_id
  IF admin_id IS NULL OR admin_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: admin_id does not match authenticated user';
  END IF;
  
  -- SECURITY: Verify caller is in admin_users table
  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: caller is not an admin. Contact support.';
  END IF;

  -- Business logic (unchanged)
  INSERT INTO public.beta_testers (email, added_by)
  VALUES (request_email, admin_id)
  ON CONFLICT (email) DO NOTHING;
  
  UPDATE public.beta_requests
  SET status = 'approved'
  WHERE email = request_email;
  
  RAISE NOTICE 'Beta request approved for %', request_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 3: REVOKE PUBLIC ACCESS
-- =====================================================

-- Revoke from public and anon roles
REVOKE ALL ON FUNCTION approve_beta_request(TEXT, UUID) FROM public;
REVOKE ALL ON FUNCTION approve_beta_request(TEXT, UUID) FROM anon;

-- Grant only to authenticated users (function self-validates admin status)
GRANT EXECUTE ON FUNCTION approve_beta_request(TEXT, UUID) TO authenticated;

-- =====================================================
-- STEP 4: ADD YOUR ADMIN(S)
-- =====================================================

-- IMPORTANT: Replace with your actual admin user IDs
-- You can find user IDs in Supabase Dashboard > Authentication > Users

-- Example (uncomment and modify):
-- INSERT INTO admin_users (user_id, email) 
-- VALUES 
--   ('your-admin-uuid-here', 'admin@example.com')
-- ON CONFLICT (user_id) DO NOTHING;

-- =====================================================
-- STEP 5: VERIFY
-- =====================================================

-- Check function exists with proper security
SELECT 
  proname, prosecdef, proacl 
FROM pg_proc 
WHERE proname = 'approve_beta_request';

-- Check admin_users table
SELECT * FROM admin_users;

-- Test: This should FAIL for non-admins
-- SELECT approve_beta_request('test@test.com', auth.uid());
