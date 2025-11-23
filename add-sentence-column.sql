-- Script SQL pour ajouter la colonne fill_in_blank_sentence à la table nlapp_words
-- Exécutez ce script dans l'éditeur SQL de Supabase

-- Ajouter la colonne pour stocker la phrase à trous générée
ALTER TABLE nlapp_words 
  ADD COLUMN IF NOT EXISTS fill_in_blank_sentence TEXT;

-- Commentaire pour documenter la colonne
COMMENT ON COLUMN nlapp_words.fill_in_blank_sentence IS 'Phrase à trous générée par DeepSeek pour ce mot (format: phrase avec [MOT] ou _____)';

-- Vérifier que la colonne a été ajoutée
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'nlapp_words'
  AND column_name = 'fill_in_blank_sentence';

