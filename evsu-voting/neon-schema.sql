-- ============================================
-- EVSU VOTING SYSTEM - NEON DATABASE SCHEMA
-- Run this in the Neon SQL Editor
-- ============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. STUDENTS TABLE (populated by admin Excel import) — created first because users references it
CREATE TABLE IF NOT EXISTS public.students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  program TEXT,
  department TEXT,
  year_level TEXT,
  is_registered BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. USERS TABLE (replaces auth.users + profiles)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id TEXT REFERENCES public.students(student_id),
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  email_verified BOOLEAN DEFAULT FALSE,
  email_verification_token TEXT,
  email_verification_expires TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ORGANIZATIONS TABLE
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. STUDENT-ORGANIZATION JUNCTION TABLE
CREATE TABLE IF NOT EXISTS public.student_organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  UNIQUE(student_id, organization_id)
);

-- 5. ELECTIONS TABLE
CREATE TABLE IF NOT EXISTS public.elections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('government', 'policy', 'organization')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed')),
  organization_id UUID REFERENCES public.organizations(id),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. POSITIONS TABLE
CREATE TABLE IF NOT EXISTS public.positions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  election_id UUID REFERENCES public.elections(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  max_votes INT DEFAULT 1,
  display_order INT DEFAULT 0
);

-- 7. CANDIDATES TABLE
CREATE TABLE IF NOT EXISTS public.candidates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  position_id UUID REFERENCES public.positions(id) ON DELETE CASCADE,
  election_id UUID REFERENCES public.elections(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  party TEXT,
  motto TEXT,
  platform TEXT,
  photo_url TEXT,
  department TEXT,
  year_level TEXT
);

-- 8. POLICY OPTIONS TABLE
CREATE TABLE IF NOT EXISTS public.policy_options (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  election_id UUID REFERENCES public.elections(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  display_order INT DEFAULT 0
);

-- 9. VOTES TABLE
CREATE TABLE IF NOT EXISTS public.votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  election_id UUID REFERENCES public.elections(id) ON DELETE CASCADE,
  position_id UUID REFERENCES public.positions(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
  policy_option_id UUID REFERENCES public.policy_options(id) ON DELETE CASCADE,
  policy_vote TEXT CHECK (policy_vote IN ('yes', 'no', 'abstain')),
  voter_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. PASSWORD RESET TOKENS
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: one vote per position per voter
CREATE UNIQUE INDEX IF NOT EXISTS unique_vote_per_position
  ON public.votes(election_id, position_id, voter_id)
  WHERE position_id IS NOT NULL;

-- Unique constraint: one vote per policy option per voter
CREATE UNIQUE INDEX IF NOT EXISTS unique_vote_per_policy
  ON public.votes(election_id, policy_option_id, voter_id)
  WHERE policy_option_id IS NOT NULL;

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_students_student_id ON public.students(student_id);
CREATE INDEX IF NOT EXISTS idx_users_student_id ON public.users(student_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_elections_status ON public.elections(status);
CREATE INDEX IF NOT EXISTS idx_votes_election ON public.votes(election_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter ON public.votes(voter_id);
CREATE INDEX IF NOT EXISTS idx_candidates_election ON public.candidates(election_id);

-- ============================================
-- TRIGGER: Mark student as registered when user is created
-- ============================================
CREATE OR REPLACE FUNCTION public.mark_student_registered()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.students SET is_registered = TRUE WHERE student_id = NEW.student_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_user_created ON public.users;
CREATE TRIGGER on_user_created
  AFTER INSERT ON public.users
  FOR EACH ROW
  WHEN (NEW.student_id IS NOT NULL)
  EXECUTE FUNCTION public.mark_student_registered();
