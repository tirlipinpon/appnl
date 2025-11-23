-- Script SQL pour ajouter la colonne fill_in_blank_sentence_fr pour les phrases françaises
-- Exécutez ce script dans l'éditeur SQL de Supabase

-- Ajouter la colonne pour stocker les phrases françaises (direction french_to_dutch)
ALTER TABLE nlapp_words 
  ADD COLUMN IF NOT EXISTS fill_in_blank_sentence_fr TEXT;

-- Commentaire pour documenter la colonne
COMMENT ON COLUMN nlapp_words.fill_in_blank_sentence_fr IS 'Phrase à trous en français générée par DeepSeek pour ce mot (direction: français → néerlandais)';

-- Vérifier que la colonne a été ajoutée
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'nlapp_words'
  AND column_name IN ('fill_in_blank_sentence', 'fill_in_blank_sentence_fr')
ORDER BY column_name;



