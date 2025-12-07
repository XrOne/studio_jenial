-- ================================================
-- Google Drive Integration - Token Storage
-- ================================================
-- This table stores OAuth2 tokens for Google Drive access
-- Users can connect their Drive to save generated videos/images

CREATE TABLE IF NOT EXISTS user_google_drive_tokens (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expiry_date BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE user_google_drive_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own tokens
CREATE POLICY "Users can view own tokens" ON user_google_drive_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own tokens
CREATE POLICY "Users can insert own tokens" ON user_google_drive_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own tokens
CREATE POLICY "Users can update own tokens" ON user_google_drive_tokens
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own tokens
CREATE POLICY "Users can delete own tokens" ON user_google_drive_tokens
  FOR DELETE
  USING (auth.uid() = user_id);

-- Policy: Service role can manage all tokens (for backend operations)
CREATE POLICY "Service role full access" ON user_google_drive_tokens
  FOR ALL
  USING (auth.role() = 'service_role');

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_drive_tokens_user_id ON user_google_drive_tokens(user_id);

-- ================================================
-- Usage Instructions
-- ================================================
-- 1. Run this script in Supabase SQL Editor
-- 2. Set these environment variables in your backend:
--    - GOOGLE_CLIENT_ID: From Google Cloud Console
--    - GOOGLE_CLIENT_SECRET: From Google Cloud Console
--    - GOOGLE_REDIRECT_URI: Your callback URL (e.g., https://yourapp.com/api/google/drive/callback)
-- 3. Enable "Google Drive API" in Google Cloud Console
-- 4. Configure OAuth consent screen with scope: https://www.googleapis.com/auth/drive.file
