-- Script SQL pour forcer PostgREST à recharger les tables
-- Copiez-collez ce script dans l'éditeur SQL de Supabase et exécutez-le

-- 1. Supprimer toutes les tables nlapp_* existantes
DROP TABLE IF EXISTS nlapp_quiz_attempts CASCADE;
DROP TABLE IF EXISTS nlapp_user_lessons CASCADE;
DROP TABLE IF EXISTS nlapp_user_progress CASCADE;
DROP TABLE IF EXISTS nlapp_words CASCADE;
DROP TABLE IF EXISTS nlapp_lessons CASCADE;
DROP TABLE IF EXISTS nlapp_profiles CASCADE;

-- 2. Recréer les tables
CREATE TABLE nlapp_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  progression_globale JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE nlapp_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE nlapp_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES nlapp_lessons(id) ON DELETE CASCADE,
  french_text TEXT NOT NULL,
  dutch_text TEXT NOT NULL,
  audio_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE nlapp_user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  word_id UUID REFERENCES nlapp_words(id) ON DELETE CASCADE,
  times_seen INTEGER DEFAULT 0,
  times_correct INTEGER DEFAULT 0,
  times_incorrect INTEGER DEFAULT 0,
  next_review_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  interval_days INTEGER DEFAULT 1,
  ease_factor DECIMAL DEFAULT 2.5,
  last_reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, word_id)
);

CREATE TABLE nlapp_user_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES nlapp_lessons(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

CREATE TABLE nlapp_quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  word_id UUID REFERENCES nlapp_words(id) ON DELETE CASCADE,
  quiz_type TEXT NOT NULL CHECK (quiz_type IN ('multiple_choice', 'typing')),
  direction TEXT NOT NULL CHECK (direction IN ('french_to_dutch', 'dutch_to_french')),
  user_answer TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- 4. RLS
ALTER TABLE nlapp_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE nlapp_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE nlapp_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE nlapp_user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE nlapp_user_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE nlapp_quiz_attempts ENABLE ROW LEVEL SECURITY;

-- 5. Policies
CREATE POLICY "Users can view own profile"
  ON nlapp_profiles FOR SELECT
  TO public
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON nlapp_profiles FOR UPDATE
  TO public
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view lessons"
  ON nlapp_lessons FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can view words"
  ON nlapp_words FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can manage own progress"
  ON nlapp_user_progress FOR ALL
  TO public
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own lessons"
  ON nlapp_user_lessons FOR ALL
  TO public
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own quiz attempts"
  ON nlapp_quiz_attempts FOR INSERT
  TO public
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own quiz attempts"
  ON nlapp_quiz_attempts FOR SELECT
  TO public
  USING (auth.uid() = user_id);

-- 6. Triggers pour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_nlapp_profiles_updated_at
  BEFORE UPDATE ON nlapp_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_nlapp_lessons_updated_at
  BEFORE UPDATE ON nlapp_lessons
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_nlapp_words_updated_at
  BEFORE UPDATE ON nlapp_words
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_nlapp_user_progress_updated_at
  BEFORE UPDATE ON nlapp_user_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_nlapp_user_lessons_updated_at
  BEFORE UPDATE ON nlapp_user_lessons
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 7. Données de test
INSERT INTO nlapp_lessons (id, title, description, order_index) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Leçon 1: Salutations', 'Apprenez les salutations de base en néerlandais', 1),
  ('00000000-0000-0000-0000-000000000002', 'Leçon 2: Nombres', 'Apprenez les nombres de 1 à 20', 2),
  ('00000000-0000-0000-0000-000000000003', 'Leçon 3: Couleurs', 'Apprenez les couleurs de base', 3);

INSERT INTO nlapp_words (lesson_id, french_text, dutch_text) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Bonjour', 'Hallo'),
  ('00000000-0000-0000-0000-000000000001', 'Au revoir', 'Tot ziens'),
  ('00000000-0000-0000-0000-000000000001', 'Merci', 'Dank je'),
  ('00000000-0000-0000-0000-000000000002', 'Un', 'Een'),
  ('00000000-0000-0000-0000-000000000002', 'Deux', 'Twee'),
  ('00000000-0000-0000-0000-000000000002', 'Trois', 'Drie'),
  ('00000000-0000-0000-0000-000000000003', 'Rouge', 'Rood'),
  ('00000000-0000-0000-0000-000000000003', 'Bleu', 'Blauw'),
  ('00000000-0000-0000-0000-000000000003', 'Vert', 'Groen');

-- 8. Forcer PostgREST à recharger (via NOTIFY)
NOTIFY pgrst, 'reload schema';

