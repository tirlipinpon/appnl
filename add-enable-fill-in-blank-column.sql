-- Script SQL pour ajouter la colonne enable_fill_in_blank à la table nlapp_lessons
-- Exécutez ce script dans l'éditeur SQL de Supabase

-- Ajouter la colonne pour activer/désactiver le test phrase à trous
ALTER TABLE nlapp_lessons 
  ADD COLUMN IF NOT EXISTS enable_fill_in_blank BOOLEAN DEFAULT true;

-- Commentaire pour documenter la colonne
COMMENT ON COLUMN nlapp_lessons.enable_fill_in_blank IS 'Active ou désactive le test "phrase à trous" pour cette leçon (true par défaut)';

-- Mettre à jour les leçons existantes pour activer le test par défaut
UPDATE nlapp_lessons 
SET enable_fill_in_blank = true 
WHERE enable_fill_in_blank IS NULL;

-- Vérifier que la colonne a été ajoutée
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'nlapp_lessons'
  AND column_name = 'enable_fill_in_blank';

