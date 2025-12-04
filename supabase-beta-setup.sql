-- Studio Jenial - Beta Access System Schema
-- Execute this script in your Supabase SQL Editor

-- =====================================================
-- 1. TABLES
-- =====================================================

-- Table for approved beta testers
CREATE TABLE IF NOT EXISTS public.beta_testers (
  email TEXT PRIMARY KEY,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  added_by UUID REFERENCES auth.users(id)
);

-- Table for access requests
CREATE TABLE IF NOT EXISTS public.beta_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.beta_testers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beta_requests ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. POLICIES
-- =====================================================

-- BETA TESTERS POLICIES
-- Everyone can read (to check if they are whitelisted) - but ideally only authenticated? 
-- For the login flow, we might need to read this BEFORE full auth or right after.
-- Let's allow authenticated users to read.
CREATE POLICY "Authenticated users can read beta_testers"
ON public.beta_testers FOR SELECT
TO authenticated
USING (true);

-- Only admins can insert/delete (we'll assume specific emails are admins for now, or service role)
-- For simplicity, we'll allow authenticated users to insert if they are already in beta_testers (viral invite?) 
-- OR strictly restrict to service_role for now until Admin UI is built.
-- Let's use service_role for admin actions initially.

-- BETA REQUESTS POLICIES
-- Anyone can insert (public request form)
CREATE POLICY "Anyone can request access"
ON public.beta_requests FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only admins (service_role) or the user themselves can read their request?
-- Let's allow service_role only for reading requests for now.

-- =====================================================
-- 3. FUNCTIONS (Optional)
-- =====================================================

-- Function to auto-approve (can be called by admin)
CREATE OR REPLACE FUNCTION approve_beta_request(request_email TEXT, admin_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Insert into testers
  INSERT INTO public.beta_testers (email, added_by)
  VALUES (request_email, admin_id)
  ON CONFLICT (email) DO NOTHING;
  
  -- Update request status
  UPDATE public.beta_requests
  SET status = 'approved'
  WHERE email = request_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
