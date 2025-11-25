-- Script SQL pour créer la table nlapp_error_sentences
-- Exécutez ce script dans l'éditeur SQL de Supabase

-- Table pour stocker les phrases avec erreurs grammaticales
CREATE TABLE IF NOT EXISTS nlapp_error_sentences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word_id UUID NOT NULL REFERENCES nlapp_words(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES nlapp_lessons(id) ON DELETE CASCADE,
  
  -- Phrase avec erreur (dans la langue cible)
  sentence_with_error TEXT NOT NULL,
  
  -- Phrase correcte (pour validation)
  sentence_correct TEXT NOT NULL,
  
  -- Type d'erreur (pour catégorisation)
  error_type TEXT, -- Ex: 'word_order', 'conjugation', 'article', 'preposition', etc.
  
  -- Direction de traduction
  direction TEXT NOT NULL CHECK (direction IN ('french_to_dutch', 'dutch_to_french')),
  
  -- Position de l'erreur (optionnel, pour surligner)
  error_position_start INTEGER,
  error_position_end INTEGER,
  
  -- Explication de l'erreur (pour feedback pédagogique)
  explanation TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_error_sentences_word_id ON nlapp_error_sentences(word_id);
CREATE INDEX IF NOT EXISTS idx_error_sentences_lesson_id ON nlapp_error_sentences(lesson_id);
CREATE INDEX IF NOT EXISTS idx_error_sentences_direction ON nlapp_error_sentences(direction);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_error_sentences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour updated_at automatiquement
CREATE TRIGGER trigger_update_error_sentences_updated_at
  BEFORE UPDATE ON nlapp_error_sentences
  FOR EACH ROW
  EXECUTE FUNCTION update_error_sentences_updated_at();

-- Activer RLS (Row Level Security)
ALTER TABLE nlapp_error_sentences ENABLE ROW LEVEL SECURITY;

-- Policy : Les utilisateurs authentifiés peuvent lire toutes les phrases avec erreurs
CREATE POLICY "Users can view error sentences"
  ON nlapp_error_sentences
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy : Les utilisateurs authentifiés peuvent créer des phrases avec erreurs
CREATE POLICY "Users can create error sentences"
  ON nlapp_error_sentences
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy : Les utilisateurs authentifiés peuvent mettre à jour les phrases avec erreurs
CREATE POLICY "Users can update error sentences"
  ON nlapp_error_sentences
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy : Les utilisateurs authentifiés peuvent supprimer les phrases avec erreurs
CREATE POLICY "Users can delete error sentences"
  ON nlapp_error_sentences
  FOR DELETE
  TO authenticated
  USING (true);

