-- Studio Jenial - Security Patch: approve_beta_request
-- Execute this in Supabase SQL Editor

-- Create admin users table
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Drop and recreate secure function
DROP FUNCTION IF EXISTS approve_beta_request(TEXT, UUID);

CREATE OR REPLACE FUNCTION approve_beta_request(request_email TEXT, admin_id UUID)
RETURNS VOID AS $$
BEGIN
  IF admin_id IS NULL OR admin_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: admin_id mismatch';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: not an admin';
  END IF;

  INSERT INTO public.beta_testers (email, added_by)
  VALUES (request_email, admin_id)
  ON CONFLICT (email) DO NOTHING;
  
  UPDATE public.beta_requests SET status = 'approved' WHERE email = request_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION approve_beta_request(TEXT, UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION approve_beta_request(TEXT, UUID) TO authenticated;
