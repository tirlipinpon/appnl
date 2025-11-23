-- Migration pour créer la table des modifications personnelles des leçons
-- Cette table permet à chaque utilisateur de masquer ou ajouter des mots dans ses versions personnelles des leçons

-- Table des modifications personnelles des mots dans les leçons
CREATE TABLE IF NOT EXISTS nlapp_user_lesson_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES nlapp_lessons(id) ON DELETE CASCADE,
  word_id UUID REFERENCES nlapp_words(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('hide', 'add')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, lesson_id, word_id, action)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_user_lesson_words_user_id ON nlapp_user_lesson_words(user_id);
CREATE INDEX IF NOT EXISTS idx_user_lesson_words_lesson_id ON nlapp_user_lesson_words(lesson_id);
CREATE INDEX IF NOT EXISTS idx_user_lesson_words_word_id ON nlapp_user_lesson_words(word_id);
CREATE INDEX IF NOT EXISTS idx_user_lesson_words_user_lesson ON nlapp_user_lesson_words(user_id, lesson_id);

-- Activer RLS
ALTER TABLE nlapp_user_lesson_words ENABLE ROW LEVEL SECURITY;

-- Policies RLS : chaque utilisateur ne peut voir/modifier que ses propres modifications
CREATE POLICY "Users can view their own lesson word modifications"
  ON nlapp_user_lesson_words FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own lesson word modifications"
  ON nlapp_user_lesson_words FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own lesson word modifications"
  ON nlapp_user_lesson_words FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own lesson word modifications"
  ON nlapp_user_lesson_words FOR DELETE
  USING (auth.uid() = user_id);

