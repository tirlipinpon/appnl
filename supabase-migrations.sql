-- Migration pour créer les tables de l'application d'apprentissage du néerlandais
-- Préfixe: nlapp_

-- Table des profils utilisateurs (extension de auth.users)
CREATE TABLE IF NOT EXISTS nlapp_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  progression_globale JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des leçons
CREATE TABLE IF NOT EXISTS nlapp_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des mots (flashcards)
CREATE TABLE IF NOT EXISTS nlapp_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES nlapp_lessons(id) ON DELETE CASCADE,
  french_text TEXT NOT NULL,
  dutch_text TEXT NOT NULL,
  audio_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table de progression des utilisateurs
CREATE TABLE IF NOT EXISTS nlapp_user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word_id UUID NOT NULL REFERENCES nlapp_words(id) ON DELETE CASCADE,
  times_seen INTEGER DEFAULT 0,
  times_correct INTEGER DEFAULT 0,
  times_incorrect INTEGER DEFAULT 0,
  next_review_date TIMESTAMP WITH TIME ZONE,
  interval_days INTEGER DEFAULT 1,
  ease_factor DECIMAL(5,2) DEFAULT 2.5,
  last_reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, word_id)
);

-- Table des leçons complétées par les utilisateurs
CREATE TABLE IF NOT EXISTS nlapp_user_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES nlapp_lessons(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

-- Table des tentatives de quiz
CREATE TABLE IF NOT EXISTS nlapp_quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word_id UUID NOT NULL REFERENCES nlapp_words(id) ON DELETE CASCADE,
  quiz_type TEXT NOT NULL CHECK (quiz_type IN ('multiple_choice', 'typing')),
  direction TEXT NOT NULL CHECK (direction IN ('french_to_dutch', 'dutch_to_french')),
  user_answer TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_words_lesson_id ON nlapp_words(lesson_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON nlapp_user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_word_id ON nlapp_user_progress(word_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_next_review ON nlapp_user_progress(next_review_date);
CREATE INDEX IF NOT EXISTS idx_user_lessons_user_id ON nlapp_user_lessons(user_id);
CREATE INDEX IF NOT EXISTS idx_user_lessons_lesson_id ON nlapp_user_lessons(lesson_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON nlapp_quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_word_id ON nlapp_quiz_attempts(word_id);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour mettre à jour updated_at
CREATE TRIGGER update_nlapp_profiles_updated_at BEFORE UPDATE ON nlapp_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_nlapp_lessons_updated_at BEFORE UPDATE ON nlapp_lessons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_nlapp_words_updated_at BEFORE UPDATE ON nlapp_words
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_nlapp_user_progress_updated_at BEFORE UPDATE ON nlapp_user_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_nlapp_user_lessons_updated_at BEFORE UPDATE ON nlapp_user_lessons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies

-- Activer RLS sur toutes les tables
ALTER TABLE nlapp_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE nlapp_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE nlapp_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE nlapp_user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE nlapp_user_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE nlapp_quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Policies pour nlapp_profiles
CREATE POLICY "Users can view their own profile"
  ON nlapp_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON nlapp_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON nlapp_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policies pour nlapp_lessons (lecture publique)
CREATE POLICY "Anyone can view lessons"
  ON nlapp_lessons FOR SELECT
  USING (true);

-- Policies pour nlapp_words (lecture publique)
CREATE POLICY "Anyone can view words"
  ON nlapp_words FOR SELECT
  USING (true);

-- Policies pour nlapp_user_progress
CREATE POLICY "Users can view their own progress"
  ON nlapp_user_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own progress"
  ON nlapp_user_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress"
  ON nlapp_user_progress FOR UPDATE
  USING (auth.uid() = user_id);

-- Policies pour nlapp_user_lessons
CREATE POLICY "Users can view their own lessons"
  ON nlapp_user_lessons FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own lessons"
  ON nlapp_user_lessons FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own lessons"
  ON nlapp_user_lessons FOR UPDATE
  USING (auth.uid() = user_id);

-- Policies pour nlapp_quiz_attempts
CREATE POLICY "Users can view their own quiz attempts"
  ON nlapp_quiz_attempts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own quiz attempts"
  ON nlapp_quiz_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Note: Pour permettre aux admins de créer/modifier les leçons et mots,
-- vous devrez créer un rôle admin dans auth.users metadata ou une table séparée
-- et ajuster les policies en conséquence. Pour l'instant, les admins peuvent
-- utiliser le dashboard Supabase directement.

-- Données de démonstration
INSERT INTO nlapp_lessons (id, title, description, order_index) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Leçon 1: Salutations', 'Apprenez les salutations de base en néerlandais', 1),
  ('00000000-0000-0000-0000-000000000002', 'Leçon 2: Nombres', 'Apprenez les nombres de 1 à 20', 2),
  ('00000000-0000-0000-0000-000000000003', 'Leçon 3: Couleurs', 'Apprenez les couleurs de base', 3)
ON CONFLICT DO NOTHING;

INSERT INTO nlapp_words (lesson_id, french_text, dutch_text) VALUES
  -- Leçon 1: Salutations
  ('00000000-0000-0000-0000-000000000001', 'Bonjour', 'Hallo'),
  ('00000000-0000-0000-0000-000000000001', 'Bonsoir', 'Goedenavond'),
  ('00000000-0000-0000-0000-000000000001', 'Au revoir', 'Tot ziens'),
  ('00000000-0000-0000-0000-000000000001', 'Merci', 'Dank je'),
  ('00000000-0000-0000-0000-000000000001', 'S''il vous plaît', 'Alsjeblieft'),
  ('00000000-0000-0000-0000-000000000001', 'Excusez-moi', 'Sorry'),
  ('00000000-0000-0000-0000-000000000001', 'Comment allez-vous?', 'Hoe gaat het?'),
  ('00000000-0000-0000-0000-000000000001', 'Très bien', 'Heel goed'),
  
  -- Leçon 2: Nombres
  ('00000000-0000-0000-0000-000000000002', 'Un', 'Een'),
  ('00000000-0000-0000-0000-000000000002', 'Deux', 'Twee'),
  ('00000000-0000-0000-0000-000000000002', 'Trois', 'Drie'),
  ('00000000-0000-0000-0000-000000000002', 'Quatre', 'Vier'),
  ('00000000-0000-0000-0000-000000000002', 'Cinq', 'Vijf'),
  ('00000000-0000-0000-0000-000000000002', 'Six', 'Zes'),
  ('00000000-0000-0000-0000-000000000002', 'Sept', 'Zeven'),
  ('00000000-0000-0000-0000-000000000002', 'Huit', 'Acht'),
  ('00000000-0000-0000-0000-000000000002', 'Neuf', 'Negen'),
  ('00000000-0000-0000-0000-000000000002', 'Dix', 'Tien'),
  
  -- Leçon 3: Couleurs
  ('00000000-0000-0000-0000-000000000003', 'Rouge', 'Rood'),
  ('00000000-0000-0000-0000-000000000003', 'Bleu', 'Blauw'),
  ('00000000-0000-0000-0000-000000000003', 'Vert', 'Groen'),
  ('00000000-0000-0000-0000-000000000003', 'Jaune', 'Geel'),
  ('00000000-0000-0000-0000-000000000003', 'Noir', 'Zwart'),
  ('00000000-0000-0000-0000-000000000003', 'Blanc', 'Wit'),
  ('00000000-0000-0000-0000-000000000003', 'Orange', 'Oranje'),
  ('00000000-0000-0000-0000-000000000003', 'Violet', 'Paars')
ON CONFLICT DO NOTHING;

