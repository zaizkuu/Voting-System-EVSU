-- ============================================
-- EVSU VOTING SYSTEM - DATABASE SCHEMA
-- Run this in the Supabase SQL Editor
-- ============================================

-- 1. STUDENTS TABLE (populated by admin Excel import)
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

-- 2. ORGANIZATIONS TABLE
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. STUDENT-ORGANIZATION JUNCTION TABLE
CREATE TABLE IF NOT EXISTS public.student_organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  UNIQUE(student_id, organization_id)
);

-- 4. PROFILES TABLE (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id TEXT REFERENCES public.students(student_id),
  full_name TEXT NOT NULL,
  email TEXT,
  role TEXT DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
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
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. POSITIONS TABLE (for government/org elections)
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
  platform TEXT,
  photo_url TEXT,
  department TEXT,
  year_level TEXT
);

-- 8. POLICY OPTIONS TABLE (for policy voting)
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
  voter_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS idx_profiles_student_id ON public.profiles(student_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_elections_status ON public.elections(status);
CREATE INDEX IF NOT EXISTS idx_votes_election ON public.votes(election_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter ON public.votes(voter_id);
CREATE INDEX IF NOT EXISTS idx_candidates_election ON public.candidates(election_id);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read students" ON public.students FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert students" ON public.students FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can update students" ON public.students FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can delete students" ON public.students FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read organizations" ON public.organizations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage organizations" ON public.organizations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

ALTER TABLE public.student_organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read student_organizations" ON public.student_organizations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage student_organizations" ON public.student_organizations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

ALTER TABLE public.elections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read elections" ON public.elections FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage elections" ON public.elections FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read positions" ON public.positions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage positions" ON public.positions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read candidates" ON public.candidates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage candidates" ON public.candidates FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

ALTER TABLE public.policy_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read policy_options" ON public.policy_options FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage policy_options" ON public.policy_options FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read votes" ON public.votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own votes" ON public.votes FOR INSERT TO authenticated WITH CHECK (voter_id = auth.uid());

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION public.validate_student_id(p_student_id TEXT)
RETURNS JSON AS $$
DECLARE
  student_record RECORD;
BEGIN
  SELECT * INTO student_record FROM public.students WHERE student_id = p_student_id;
  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'error', 'Invalid Student ID');
  END IF;
  IF student_record.is_registered THEN
    RETURN json_build_object('valid', false, 'error', 'This Student ID is already registered');
  END IF;
  RETURN json_build_object('valid', true, 'full_name', student_record.full_name, 'email', student_record.email);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Mark student as registered when profile is created
CREATE OR REPLACE FUNCTION public.mark_student_registered()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.students SET is_registered = TRUE WHERE student_id = NEW.student_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  WHEN (NEW.student_id IS NOT NULL)
  EXECUTE FUNCTION public.mark_student_registered();

-- ============================================
-- STORAGE BUCKET for candidate photos
-- ============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('candidate-photos', 'candidate-photos', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "Anyone can read candidate photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'candidate-photos');

CREATE POLICY "Admins can upload candidate photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'candidate-photos' AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
