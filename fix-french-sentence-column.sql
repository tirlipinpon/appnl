-- Script SQL pour ajouter la colonne fill_in_blank_sentence_fr et forcer PostgREST à recharger
-- Exécutez ce script dans l'éditeur SQL de Supabase
-- IMPORTANT: Après l'exécution, attendez quelques secondes pour que PostgREST recharge son cache

-- Étape 1: Ajouter la colonne fill_in_blank_sentence si elle n'existe pas déjà
ALTER TABLE nlapp_words 
  ADD COLUMN IF NOT EXISTS fill_in_blank_sentence TEXT;

-- Étape 2: Ajouter la colonne fill_in_blank_sentence_fr si elle n'existe pas déjà
ALTER TABLE nlapp_words 
  ADD COLUMN IF NOT EXISTS fill_in_blank_sentence_fr TEXT;

-- Étape 3: Ajouter des commentaires pour documenter les colonnes
COMMENT ON COLUMN nlapp_words.fill_in_blank_sentence IS 'Phrase à trous en néerlandais générée par DeepSeek pour ce mot (direction: néerlandais → français)';
COMMENT ON COLUMN nlapp_words.fill_in_blank_sentence_fr IS 'Phrase à trous en français générée par DeepSeek pour ce mot (direction: français → néerlandais)';

-- Étape 4: Vérifier que les colonnes existent bien
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'nlapp_words'
  AND column_name IN ('fill_in_blank_sentence', 'fill_in_blank_sentence_fr')
ORDER BY column_name;

-- Étape 5: Forcer PostgREST à recharger le schéma
-- Cette commande notifie PostgREST qu'il doit recharger son cache de schéma
NOTIFY pgrst, 'reload schema';

-- Note: Après l'exécution de ce script, attendez 5-10 secondes avant de tester l'application
-- pour permettre à PostgREST de recharger son cache.

